# Servidor local para acessar o app pelo celular na mesma rede Wi-Fi
$raiz = "C:\Users\depau\Documents\Default Project\app-gastos"
$porta = 8080
$prefixo = "http://+:$porta/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefixo)
try { $listener.Start() } catch {
    Write-Host "Porta $porta ocupada ou sem permissao. Feche outros servidores e rode como Admin se precisar." -ForegroundColor Red
    pause; exit
}

$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } |
    Select-Object -ExpandProperty IPAddress -First 3

Write-Host ""
Write-Host "=== SERVIDOR RODANDO ===" -ForegroundColor Green
Write-Host ""
Write-Host "No CELULAR (mesmo Wi-Fi), abra no navegador:" -ForegroundColor Cyan
foreach ($ip in $ips) { Write-Host "   http://${ip}:8080" -ForegroundColor Yellow }
Write-Host ""
Write-Host "No PC: http://localhost:8080"
Write-Host ""
Write-Host "Pressione CTRL+C para encerrar." -ForegroundColor DarkGray

$mimes = @{
    ".html"="text/html; charset=utf-8"; ".js"="application/javascript"; ".json"="application/json";
    ".png"="image/png"; ".ico"="image/x-icon"; ".css"="text/css"
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $resp = $ctx.Response
    try {
        $caminhoRel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
        if ($caminhoRel -eq "/") { $caminhoRel = "/index.html" }
        $arquivo = Join-Path $raiz $caminhoRel.TrimStart("/")

        if (Test-Path $arquivo -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($arquivo).ToLower()
            if ($mimes.ContainsKey($ext)) { $resp.ContentType = $mimes[$ext] }
            $bytes = [System.IO.File]::ReadAllBytes($arquivo)
            $resp.ContentLength64 = $bytes.Length
            $resp.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $resp.StatusCode = 404
        }
    } catch {}
    finally { $resp.Close() }
}