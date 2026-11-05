param([string]$BaseUrl = 'http://localhost:8080')
$ErrorActionPreference = 'Stop'
$flagPath = Join-Path $PSScriptRoot 'config/flags.properties'
$original = [System.IO.File]::ReadAllText($flagPath)
$initialInstance = $null
$results = @()
try {
    foreach ($stage in @(
        @{ Name = 'Desligada'; Enabled = 'false'; Percentage = 100 },
        @{ Name = 'Liberacao 10%'; Enabled = 'true'; Percentage = 10 },
        @{ Name = 'Liberacao 50%'; Enabled = 'true'; Percentage = 50 },
        @{ Name = 'Liberacao 100%'; Enabled = 'true'; Percentage = 100 },
        @{ Name = 'Desligamento imediato'; Enabled = 'false'; Percentage = 100 }
    )) {
        $content = "recommendations.enabled=$($stage.Enabled)`nrecommendations.percentage=$($stage.Percentage)`n"
        [System.IO.File]::WriteAllText($flagPath, $content)
        $active = 0
        $selected = @()
        foreach ($number in 1..100) {
            $response = Invoke-RestMethod "$BaseUrl/api/experience?userId=user-$number"
            if ($null -eq $initialInstance) { $initialInstance = $response.instanceId }
            if ($response.instanceId -ne $initialInstance) { throw 'A instancia mudou durante a demonstracao.' }
            if ($response.flag.active) { $active++; $selected += "user-$number" }
        }
        $results += [PSCustomObject]@{ Etapa = $stage.Name; Ativos = $active; Total = 100; InstanceId = $initialInstance }
        if ($stage.Percentage -eq 10 -and $stage.Enabled -eq 'true') { $firstCohort = $selected }
        if ($stage.Percentage -eq 50 -and $stage.Enabled -eq 'true') {
            foreach ($user in $firstCohort) { if ($user -notin $selected) { throw 'Coorte nao foi preservada.' } }
        }
        if ($stage.Enabled -eq 'false' -and $active -ne 0) { throw 'O desligamento falhou.' }
        if ($stage.Enabled -eq 'true' -and $stage.Percentage -eq 100 -and $active -ne 100) { throw 'A liberacao total falhou.' }
    }
    $results | Format-Table -AutoSize
    Write-Output 'Mesma instancia em todas as etapas. Coorte inicial preservada ao ampliar a liberacao.'
} finally {
    [System.IO.File]::WriteAllText($flagPath, $original)
}
