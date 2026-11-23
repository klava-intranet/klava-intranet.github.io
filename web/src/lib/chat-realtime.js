import { sb } from './supabase.js';

/**
 * Badge de não lidas em tempo real.
 * Antes: getUnreadCounts a cada 3s (polling). Agora: 1 consulta na abertura +
 * recálculo só quando chega mensagem nova pelo Realtime.
 */
export function iniciarNaoLidas(onChange) {
  let timer;
  const recalcular = async () => {
    const { data, error } = await sb.rpc('nao_lidas');
    if (error) return console.error('nao_lidas', error);
    onChange(data ?? []);
  };
  const agendar = () => { clearTimeout(timer); timer = setTimeout(recalcular, 300); };

  recalcular();
  const canal = sb.channel('nao-lidas')
    .on('postgres_changes', { event: 'INSERT', schema: 'intranet', table: 'mensagens' }, agendar)
    .subscribe();
  return () => sb.removeChannel(canal);
}
