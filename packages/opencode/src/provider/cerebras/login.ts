import crypto from "crypto"
import http from "http"
import open from "open"
import { Auth } from "@/auth"

export type CerebrasLoginOptions = {
  platform?: string
  port?: number
  loginPath?: string
  exchangePath?: string
  openBrowser?: boolean
  saveAuth?: boolean
  setEnv?: boolean
}

const DEFAULTS = {
  platform: "http://localhost:8000",
  port: 4567,
  loginPath: "/cli/login",
  exchangePath: "/api/cli/exchange",
  openBrowser: true,
  saveAuth: true,
  setEnv: true,
}

let inFlight = false

function randomBase64Url(length: number) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length)
}

function sha256Base64Url(input: string) {
  return crypto.createHash("sha256").update(input).digest("base64url")
}

export async function cerebrasLogin(options: CerebrasLoginOptions = {}, onStatus?: (msg: string) => void) {
  if (inFlight) {
    throw new Error("A Cerebras login is already in progress. Please wait or cancel the existing attempt.")
  }
  inFlight = true
  const { platform, port, loginPath, exchangePath, openBrowser, saveAuth, setEnv } = { ...DEFAULTS, ...options }

  const state = randomBase64Url(32)
  const verifier = randomBase64Url(43)
  const challenge = sha256Base64Url(verifier)

  const loginUrl = `${platform}${loginPath}?port=${port}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`

  let resolveCode: (code: string | null) => void = () => {}
  const codePromise = new Promise<string | null>((resolve) => {
    resolveCode = resolve
  })

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`)
    const code = url.searchParams.get("code")
    const returnedState = url.searchParams.get("state")
    if (returnedState !== state) {
      res.statusCode = 400
      res.end("State mismatch")
      resolveCode(null)
      return
    }
    if (code) {
      res.statusCode = 200
      res.setHeader("Content-Type", "text/html")
      res.end("<h1>Authorized</h1><p>You can close this tab.</p>")
      resolveCode(code)
    } else {
      res.statusCode = 400
      res.end("Missing code")
      resolveCode(null)
    }
  })

  const listenPromise = new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, resolve)
  })

  try {
    await listenPromise
  } catch (e) {
    inFlight = false
    server.close()
    throw new Error(`Failed to start local callback server on port ${port}. Is it already in use?`)
  }

  try {
    if (openBrowser) {
      await open(loginUrl)
      onStatus?.("Check your browser to complete login...")
    }
  } catch (e) {
    // Continue; user can still paste the URL manually.
  }

  let authCode: string | null = null
  try {
    authCode = await codePromise
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    inFlight = false
  }

  if (!authCode) {
    throw new Error("Authorization failed or cancelled")
  }

  const resp = await fetch(`${platform}${exchangePath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: authCode,
      code_verifier: verifier,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Exchange failed: ${text}`)
  }

  const data = await resp.json().catch(() => ({} as any))
  const apiKey = data.apiKey || data.token || data.access_token
  if (!apiKey) {
    throw new Error("No apiKey found in exchange response")
  }

  if (setEnv) {
    process.env.CEREBRAS_API_KEY = apiKey
  }
  if (saveAuth) {
    await Auth.set("cerebras", { type: "api", key: apiKey })
  }

  return { apiKey, platform }
}

