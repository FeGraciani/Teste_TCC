/**
 * Erros de negócio. As camadas de apresentação convertem estes erros em
 * mensagens amigáveis; qualquer outro erro é tratado como falha inesperada.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DOMAIN_ERROR",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Não encontramos o que você procurava.") {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Você não tem permissão para fazer isso.") {
    super(message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT");
    this.name = "ConflictError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
