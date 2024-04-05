import { request } from "undici"
import { liveAuthenticate } from "."

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
            }),
            headers: {
                'Content-Type': 'application/json'
            }
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