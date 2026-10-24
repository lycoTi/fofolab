import type { FofoContext } from './context';
import type { EditalCandidate } from './editalMatch';
import type { FofoMode } from './signals';

/**
 * Respostas de exemplo sem chave de IA (a tela sempre as rotula como "Exemplo simulado"). Mostram o formato de cada
 * jeito; nunca entregam gabarito e nunca são gravadas como explicação real.
 */
export function demoFofoReply(mode: FofoMode, ctx: FofoContext, message: string, extra: { editalCandidates?: EditalCandidate[] } = {}): string {
  const topic = `${ctx.student.currentTopicCode} ${ctx.student.currentTopicTitle}`.trim();
  const anchor = ctx.student.strongTopics[0] ?? 'um assunto que você já domina';
  switch (mode) {
    case 'QUICK':
      return `Sobre "${message}": em ${topic}, a ideia central é separar o conceito da forma como ele aparece na prática. Pense em ${anchor} como ponte.\n\nPalavras-chave: conceito, aplicação, exemplo`;
    case 'FROM_ZERO':
      return `Imagine uma cozinha de restaurante: cada pessoa tem uma tarefa, e o prato só sai quando tudo se encaixa. ${topic} funciona parecido.\n\nPor que importa: é a base para entender o resto da matéria. Quer que eu explique primeiro ${ctx.prerequisites[0] ?? 'o conceito anterior'}, ou seguimos direto?`;
    case 'LESSON':
      return `**Parte 1 de 2**\n\n**O essencial:** ${topic} em poucas linhas.\n\n**Explicação com exemplo:** um caso do dia a dia, ligado a ${anchor}.\n\n**Camadas:** conceito → exemplo → como costuma ser cobrado.\n\n**Cuidados comuns em provas:** generalizações ("sempre", "nunca") e troca de conceitos parecidos.\n\n**Para responder de cabeça:** qual é a ideia central de ${topic}?`;
    case 'SUMMARY':
      return `**📝 ${ctx.student.currentTopicTitle || 'Resumo do tópico'}**\n· **Palavras-chave:** conceito, aplicação, exemplo\n· **Conceito curto:** Resumo de exemplo do tópico em uma frase.\n· **Uso funcional:** Serve para revisar em poucos segundos.\n· **Analogia:** Como uma etiqueta numa caixa de mudança.\n· **Cuidado em prova:** Atenção a generalizações como "sempre" e "nunca".`;
    case 'EDITAL': {
      const best = extra.editalCandidates?.[0];
      if (!best) return 'Não encontrei isso no seu edital. Se for parte de uma matéria que você estuda, confira os tópicos dela no Edital.';
      return `Sim: aparece em ${best.topic.code ?? ''} ${best.topic.title} (${best.subjectName}${best.examPartCode ? `, ${best.examPartCode}` : ''}). Vale estudar quando esse tópico chegar no seu roteiro.`;
    }
    case 'HINT':
      return 'Pista: repare em qual ideia o enunciado está testando e se há alguma palavra que generaliza demais. Marque sua resposta e a confiança, mesmo chutando: tentar antes fixa mais depois.';
  }
}
