import { stringify } from "querystring";
import { request } from "undici";

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