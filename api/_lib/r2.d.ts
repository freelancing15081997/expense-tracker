export function r2Ready(): boolean;
export function r2FileKey(target: string): string;
export function r2GetBytes(key: string): Promise<{ body: Buffer; contentType: string } | null>;
export function r2GetJson(key: string): Promise<Record<string, unknown> | null>;
export function r2PutBytes(key: string, body: Buffer, contentType: string): Promise<void>;
export function r2PutJson(key: string, data: unknown): Promise<void>;
export function r2Del(key: string): Promise<void>;
export function r2ListKeys(prefix: string): Promise<string[]>;
