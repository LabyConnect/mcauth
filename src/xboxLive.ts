import { request } from "undici"
import { live } from "."

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

export class XboxLiveClient {
    static readonly instance = new this();

    constructor() {}

    exchangeRpsTicketForUserToken(rpsTicket: string, preamable: string = "t"): Promise<ExchangeRpsTicketResponse> {
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

    exchangeTokensForXSTSToken(tokens: { userTokens: string[], deviceToken?: string, titleToken?: string }): Promise<XBLExchangeTokensResponse> {
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


    async xblAuthenticate(email: string, password: string): Promise<XBLAuthenticateResponse> {
        const authenticateResponse = await live.liveAuthenticate(email, password)
        const exchangeRpsTicketResponse = await this.exchangeRpsTicketForUserToken(authenticateResponse.access_token)
        const xstsResponse = await this.exchangeTokensForXSTSToken({ userTokens: [exchangeRpsTicketResponse.Token] })

        return {
            xuid: xstsResponse.DisplayClaims.xui[0].xid,
            user_hash: xstsResponse.DisplayClaims.xui[0].uhs,
            xsts_token: xstsResponse.Token,
            display_claims: xstsResponse.DisplayClaims.xui[0],
            expires_on: xstsResponse.NotAfter
        }
    }
}

export const xboxLive = XboxLiveClient.instance;

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
