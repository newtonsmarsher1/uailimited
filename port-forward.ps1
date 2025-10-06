# Simple Port Forwarding Script for UAI Agency
param(
    [int]$LocalPort = 3000,
    [int]$RemotePort = 8080
)

Write-Host "Starting port forwarding from localhost:$LocalPort to localhost:$RemotePort" -ForegroundColor Green

# Check if server is running
$process = Get-Process -Name "node" -ErrorAction SilentlyContinue
if (-not $process) {
    Write-Host "Node.js server not running. Starting server..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "backend/server.js" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Simple HTTP proxy using PowerShell
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$RemotePort/")
$listener.Start()

Write-Host "Port forwarding active on http://localhost:$RemotePort" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        try {
            # Forward request to local server
            $webClient = New-Object System.Net.WebClient
            $targetUrl = "http://localhost:$LocalPort" + $request.Url.PathAndQuery
            
            if ($request.HttpMethod -eq "POST") {
                $body = $request.InputStream
                $bodyBytes = New-Object byte[] $request.ContentLength64
                $body.Read($bodyBytes, 0, $bodyBytes.Length)
                $responseBytes = $webClient.UploadData($targetUrl, $request.HttpMethod, $bodyBytes)
            } else {
                $responseBytes = $webClient.DownloadData($targetUrl)
            }
            
            $response.ContentLength64 = $responseBytes.Length
            $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
            $response.Close()
            
        } catch {
            $response.StatusCode = 500
            $response.Close()
            Write-Host "Error forwarding request: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
