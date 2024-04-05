import { createHash } from "crypto";
import { request } from "undici";

export class YggdrasilClient {
    static readonly instance = new this();

    constructor() {}
    
    generateHexDigest(
        serverId: string,
        sharedSecret: Buffer,
        publicKey: Buffer
    ) {
        let hash = createHash("sha1")
            .update(serverId)
            .update(sharedSecret)
            .update(publicKey)
            .digest()
    
        const isNegative = (hash.readUInt8(0) & (1 << 7)) !== 0;
        if (isNegative) {
            const inverted = Buffer.allocUnsafe(hash.length);
            let carry = 0;
    
            for (let i = hash.length - 1; i >= 0; i--) {
                let num = hash.readUInt8(i) ^ 0b11111111;
                if (i === hash.length - 1) num++;
    
                num += carry;
                carry = Math.max(0, num - 0b11111111);
                num = Math.min(0b11111111, num);
                inverted.writeUInt8(num, i);
            }
    
            hash = inverted;
        }
    
        let result = hash.toString("hex");
        if (isNegative) {
            result = "-" + result;
        }
    
        return result;
    }
    
    join(
        accessToken: string,
        selectedProfile: string, // UUID
        serverId: string,
        sharedSecret: Buffer,
        publicKey: Buffer
    ): Promise<void> {
        return new Promise((resolve) => {
            request("https://sessionserver.mojang.com/session/minecraft/join", {
                method: "POST",
                body: JSON.stringify({
                    accessToken,
                    selectedProfile,
                    serverId: this.generateHexDigest(serverId, sharedSecret, publicKey)
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            }).then(() => resolve())
        })
    }
}

export const yggdrasil = YggdrasilClient.instance;