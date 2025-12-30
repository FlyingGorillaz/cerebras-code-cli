/**
 * Cloudflare Worker for handling OpenCode feedback submissions
 */

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }
    
    const body = await request.json()
    const { message, version, os, metadata, errorName, errorMessage, errorStatusCode, errorIsRetryable, errorResponseBody, sessionID, providerID, modelID } = body
    
    // Build email text with all available information
    let emailText = `OS: ${os || "unknown"}\nVersion: ${version || "unknown"}\n\n`
    
    // Add error information if available
    if (errorName || metadata?.error) {
      emailText += "=== ERROR INFORMATION ===\n"
      if (errorName) {
        emailText += `Error Type: ${errorName}\n`
      }
      if (errorMessage) {
        emailText += `Error Message: ${errorMessage}\n`
      }
      if (errorStatusCode) {
        emailText += `Status Code: ${errorStatusCode}\n`
      }
      if (errorIsRetryable !== undefined) {
        emailText += `Retryable: ${errorIsRetryable}\n`
      }
      if (errorResponseBody) {
        emailText += `Response Body: ${errorResponseBody}\n`
      }
      // Fallback to metadata.error if flattened fields aren't present
      if (!errorName && metadata?.error) {
        emailText += `Error Name: ${metadata.error.name || "unknown"}\n`
        emailText += `Error Message: ${metadata.error.message || "unknown"}\n`
        if (metadata.error.data) {
          const errorData = metadata.error.data
          if (errorData.statusCode) emailText += `Status Code: ${errorData.statusCode}\n`
          if (errorData.isRetryable !== undefined) emailText += `Retryable: ${errorData.isRetryable}\n`
          if (errorData.responseBody) emailText += `Response Body: ${errorData.responseBody}\n`
        }
      }
      emailText += "\n"
    }
    
    // Add session and model context
    if (sessionID || providerID || modelID || metadata?.sessionID || metadata?.providerID || metadata?.modelID) {
      emailText += "=== CONTEXT ===\n"
      if (sessionID || metadata?.sessionID) {
        emailText += `Session ID: ${sessionID || metadata?.sessionID}\n`
      }
      if (providerID || metadata?.providerID) {
        emailText += `Provider: ${providerID || metadata?.providerID}\n`
      }
      if (modelID || metadata?.modelID) {
        emailText += `Model: ${modelID || metadata?.modelID}\n`
      }
      emailText += "\n"
    }
    
    // Add user message
    emailText += "=== USER MESSAGE ===\n"
    emailText += `${message || "No message provided"}\n`
    
    // Include full metadata as JSON for debugging if present
    if (metadata) {
      emailText += "\n=== FULL METADATA (JSON) ===\n"
      emailText += JSON.stringify(metadata, null, 2)
    }
    
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: "kevin.taylor@cerebras.net",
        subject: `[Cerebras Code] Feedback v${version || "unknown"}${errorName ? ` - ${errorName}` : ""}`,
        text: emailText,
      }),
    })
    
    if (!res.ok) {
      return new Response("Email failed", { status: 500 })
    }
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { "Content-Type": "application/json" } 
    })
  },
}

