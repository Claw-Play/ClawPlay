declare module "nodemailer" {
  export interface SendMailOptions {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
  }

  export interface TransportOptions {
    host: string;
    port: number;
    secure?: boolean;
    requireTLS?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>;
  }

  export function createTransport(options: TransportOptions): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
