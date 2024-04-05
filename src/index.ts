import { request } from "undici";
import { stringify } from "querystring";

export type PreAuthResponse = {
    cookie: string,
    PPFT: string,
    urlPost: string
}

export function preAuth(): Promise<PreAuthResponse> {
    return new Promise((resolve) => {
        request(
            `https://login.live.com/oauth20_authorize.srf?${stringify({
                client_id: "000000004C12AE6F",
                redirect_uri: "https://login.live.com/oauth20_desktop.srf",
                response_type: "token",
                scope: "service::user.auth.xboxlive.com::MBI_SSL"
            })}`
        ).then(async res => {
            const body = await res.body.text();
            const cookie = ((res.headers['set-cookie'] || []) as string[])
                .map((c: string) => c.split(';')[0])
                .join('; ');
        
            const PPFT =  body.match(/sFTTag:'.*value=\"(.*)\"\/>'/)?.[1]
            const urlPost = body.match(/urlPost:'(.+?(?=\'))/)?.[1]
        
            if (!PPFT || !urlPost) {
                throw new Error("Could not match PPFT or urlPost")
            }

            resolve({
                cookie,
                PPFT,
                urlPost
            } as PreAuthResponse)
        })
    })
}

export type LiveAuthenticateResponse = {
    access_token: string,
    token_type: string,
    expires_in: number,
    scope: string,
    refresh_token: string,
    user_id: string
}

export async function liveAuthenticate(email: string, password: string): Promise<LiveAuthenticateResponse> {
    const preAuthResponse = await preAuth();

    const response = await request(preAuthResponse.urlPost, {
        method: 'POST',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: preAuthResponse.cookie
        },
        body: stringify({
            login: email,
            loginfmt: email,
            passwd: password,
            PPFT: preAuthResponse.PPFT
        })
    });
  
    if (response.statusCode === 200) {
      throw `Failed to authenticate. Is 2FA enabled?`;
    }
  
    const location = response.headers['location'] as string || '';
    const hash = location.split('#')[1];
    const output = {};
  
    for (const [key, value] of Array.from(new URLSearchParams(hash))) {
      if (key === 'expires_in') {
        output[key] = Number(value);
      } else {
        output[key] = value;
      }
    }
  
    return output as LiveAuthenticateResponse;
}

export type ExchangeRpsTicketResponse = {
    IssueInstant: string,
    NotAfter: string,
    Token: string,
    DisplayClaims: {
        xui: {
            uhs: string
        }
    }
}

export async function exchangeRpsTicketForUserToken(rpsTicket: string, preamable: string = "t"): Promise<ExchangeRpsTicketResponse> {
    return new Promise((resolve) => {
        const match = rpsTicket.match(/^([t|d]=)/g);

        if (match === null) {
            rpsTicket = `${preamable}=${rpsTicket}`;
        }

    request("https://user.auth.xboxlive.com/user/authenticate", {
            method: 'POST',
            body: JSON.stringify({
                RelyingParty: 'http://auth.xboxlive.com',
                TokenType: 'JWT',
                Properties: {
                    AuthMethod: 'RPS',
                    SiteName: 'user.auth.xboxlive.com',
                    RpsTicket: rpsTicket
                }
            })
        }).then(async (res) => {
            resolve(await res.body.json() as ExchangeRpsTicketResponse)
        })
    })
}

export type XBLExchangeTokensResponse = {
    IssueInstant: string,
    NotAfter: string,
    Token: string,
    DisplayClaims: {
        xui: {
            gtg: string,
            xid: string,
            uhs: string,
            agg: string,
            usr: string,
            utr: string,
            prv: string
        }[]
    }
}

export function exchangeTokensForXSTSToken(tokens: { userTokens: string[], deviceToken?: string, titleToken?: string }): Promise<XBLExchangeTokensResponse> {
    return new Promise((resolve) => {
        request("https://xsts.auth.xboxlive.com/xsts/authorize", {
            method: 'POST',
            body: JSON.stringify({
                RelyingParty: 'rp://api.minecraftservices.com/',
                TokenType: 'JWT',
                Properties: {
                    UserTokens: tokens.userTokens,
                    DeviceToken: tokens.deviceToken,
                    TitleToken: tokens.titleToken,
                    SandboxId: "RETAIL"
                }
            })
        }).then(async (res) => {
            resolve(await res.body.json() as XBLExchangeTokensResponse)
        })
    })
}

export type XBLAuthenticateResponse = {
    xuid: string,
    user_hash: string,
    xsts_token: string,
    display_claims: {
        gtg: string,
        xid: string,
        uhs: string,
        agg: string,
        usr: string,
        utr: string,
        prv: string
    },
    expires_on: string
}

export async function xblAuthenticate(email: string, password: string): Promise<XBLAuthenticateResponse> {
    const authenticateResponse = await liveAuthenticate(email, password)
    const exchangeRpsTicketResponse = await exchangeRpsTicketForUserToken(authenticateResponse.access_token)
    const xstsResponse = await exchangeTokensForXSTSToken({ userTokens: [exchangeRpsTicketResponse.Token] })

    return {
        xuid: xstsResponse.DisplayClaims.xui[0].xid,
        user_hash: xstsResponse.DisplayClaims.xui[0].uhs,
        xsts_token: xstsResponse.Token,
        display_claims: xstsResponse.DisplayClaims.xui[0],
        expires_on: xstsResponse.NotAfter
    }
}

export type LoginWithXboxResponse = {
    username: string, // UUID (idk why it's called username)
    roles: any[], // type unknown
    metadata: Object, // type unknown
    access_token: string,
    expires_in: number,
    token_type: string
}

export function loginWithXbox(xsts: XBLAuthenticateResponse): Promise<LoginWithXboxResponse> {
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

export function fetchProfileFromAccessToken(tokenType: string, accessToken: string): Promise<MinecraftProfileResponse> {
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

export type MinecraftJavaTokenResponse = {
    profile: MinecraftProfileResponse,
    roles: any[], // type unknown
    metadata: Object, // type unknown
    token: string,
    expiresAt: Date,
    tokenType: string
}

export async function getMinecraftJavaToken(xsts: XBLAuthenticateResponse, fetchProfile: boolean): Promise<MinecraftJavaTokenResponse> {
    const loginWithXboxResponse = await loginWithXbox(xsts)

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
        result.profile = await fetchProfileFromAccessToken(loginWithXboxResponse.token_type, loginWithXboxResponse.access_token)
    }

    return result
}