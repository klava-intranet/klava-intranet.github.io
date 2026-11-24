/**
 * Upload retomável (protocolo TUS) para o Supabase Storage.
 * Envia em pedaços de 6 MB, mostra progresso e continua de onde parou se a conexão cair.
 * Necessário para arquivos grandes (acima de ~50 MB o upload comum é recusado).
 */
import * as tus from 'tus-js-client';
import { sb } from './supabase.js';

// Host direto do Storage (recomendado pelo Supabase para arquivos grandes)
const endpoint = import.meta.env.VITE_SUPABASE_URL.replace('.supabase.co', '.storage.supabase.co') + '/storage/v1/upload/resumable';

export async function uploadRetomavel(bucket, path, arquivo, aoProgredir) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente.');

  return new Promise((resolve, reject) => {
    const up = new tus.Upload(arquivo, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // o Supabase exige exatamente 6 MB
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: arquivo.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onProgress: (enviado, total) => aoProgredir && aoProgredir(Math.floor((enviado / total) * 100)),
      onSuccess: () => resolve(path),
      onError: (erro) => {
        const status = erro?.originalResponse?.getStatus?.();
        const corpo = erro?.originalResponse?.getBody?.() || '';
        if (status === 413 || /maximum allowed size|too large/i.test(corpo)) {
          reject(new Error('o Supabase recusou o tamanho do arquivo. No plano Free o limite é 50 MB; '
            + 'para até 500 MB o projeto precisa estar no plano Pro, com o limite ajustado em Storage → Settings.'));
        } else {
          reject(new Error(corpo || erro.message));
        }
      },
    });
    // retoma um envio interrompido do mesmo arquivo, se houver
    up.findPreviousUploads().then((anteriores) => {
      if (anteriores.length) up.resumeFromPreviousUpload(anteriores[0]);
      up.start();
    });
  });
}
