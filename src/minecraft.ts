import { request } from "undici"
import { XBLAuthenticateResponse, xboxLive } from "."

export class MinecraftClient {
    loginWithXbox(xsts: XBLAuthenticateResponse): Promise<LoginWithXboxResponse> {
        return new Promise((resolve) => {
            request("https://api.minecraftservices.com/authentication/login_with_xbox", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "MinecraftLauncher/2.2.10675"
                },
                body: JSON.stringify({
                    identityToken: `XBL3.0 x=${xsts.user_hash};${xsts.xsts_token}`
                })
            }).then(async (res) => {
                resolve(await res.body.json() as LoginWithXboxResponse)
            })
        })
    }


    fetchProfileFromAccessToken(tokenType: string, accessToken: string): Promise<MinecraftProfileResponse> {
        return new Promise((resolve) => {
            request(`https://api.minecraftservices.com/minecraft/profile`, {
                headers: {
                    Authorization: `${tokenType} ${accessToken}`,
                    "User-Agent": "MinecraftLauncher/2.2.10675"
                }
            }).then(async (res) => {
                resolve(await res.body.json() as MinecraftProfileResponse)
            })
        })
    }

    async getMinecraftJavaToken(xsts: XBLAuthenticateResponse, fetchProfile: boolean): Promise<MinecraftJavaTokenResponse> {
        const loginWithXboxResponse = await this.loginWithXbox(xsts)

        const result = {
            profile: {
                id: loginWithXboxResponse.username
            },
            roles: loginWithXboxResponse.roles,
            metadata: loginWithXboxResponse.metadata,
            token: loginWithXboxResponse.access_token,
            expiresAt: new Date(Date.now() + loginWithXboxResponse.expires_in * 1000),
            tokenType: loginWithXboxResponse.token_type
        }

        if (fetchProfile) {
            result.profile = await this.fetchProfileFromAccessToken(loginWithXboxResponse.token_type, loginWithXboxResponse.access_token)
        }

        return result
    }
}

export const minecraft = new MinecraftClient();

export type LoginWithXboxResponse = {
    username: string, // UUID (idk why it's called username)
    roles: any[], // type unknown
    metadata: Object, // type unknown
    access_token: string,
    expires_in: number,
    token_type: string
}

export type Cape = {
    id: string,
    state: string,
    url: string,
    alias: string
}

export type Skin = {
    id: string,
    state: string,
    url: string,
    textureKey: string,
    variant: string,
    alias: string
}

export type MinecraftProfileResponse = {
    id: string,

    // properties below is only present if fetchProfile is true
    name?: string, 
    skins?: Skin[],
    capes?: Cape[],
    profileActions?: Object // type unknown
}

export type MinecraftJavaTokenResponse = {
    profile: MinecraftProfileResponse,
    roles: any[], // type unknown
    metadata: Object, // type unknown
    token: string,
    expiresAt: Date,
    tokenType: string
}
