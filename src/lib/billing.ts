type BillingLike = { legalName: string; rfc: string; taxRegime?: string; cfdiUse?: string; zip?: string; email?: string; address?: string };

/** Texto listo para pegar en el sistema de facturación del contador. */
export function billingText(b: BillingLike) {
  return [
    `Razón social: ${b.legalName}`,
    `RFC: ${b.rfc}`,
    b.taxRegime && `Régimen fiscal: ${b.taxRegime}`,
    b.cfdiUse && `Uso de CFDI: ${b.cfdiUse}`,
    b.zip && `C.P.: ${b.zip}`,
    b.email && `Correo: ${b.email}`,
    b.address && `Domicilio: ${b.address}`,
  ]
    .filter(Boolean)
    .join("\n");
}

