declare module "qrcode" {
  export function toString(text: string, opts?: { type?: "svg" | "utf8" | "terminal"; margin?: number; errorCorrectionLevel?: "L" | "M" | "Q" | "H"; color?: { dark?: string; light?: string } }): Promise<string>;
  const _default: { toString: typeof toString };
  export default _default;
}
