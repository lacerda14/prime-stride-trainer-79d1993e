// src/lib/server-errors.ts
// =============================================================================
// Erros de servidor SEGUROS. Logam o detalhe interno (DB/infra) no servidor e
// lançam uma mensagem GENÉRICA pro cliente — nunca vazam schema/policy/stack
// (OWASP: sensitive data exposure). Use no lugar de `throw new Error(error.message)`.
//
// Erros-CONTRATO (already_premium, trial_already_used, no_active_subscription, …)
// são strings literais e NÃO passam por aqui — o front depende deles p/ fluxo.
//
// Retorna `never`: o TS trata a chamada como um `throw` (preserva narrowing).
// =============================================================================

export function serverError(publicMessage: string, internal: unknown): never {
  console.error(`[server-error] ${publicMessage}`, internal);
  throw new Error(publicMessage);
}
