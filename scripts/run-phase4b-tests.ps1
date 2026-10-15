$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$Message) {
    [Console]::Error.WriteLine("[Phase 4B] $Message")
    exit 1
}

function Assert-ApprovedTestUri([string]$Uri) {
    if ([string]::IsNullOrWhiteSpace($Uri)) {
        throw 'MONGODB_TEST_URI is required.'
    }

    if ($Uri -match '%(?![0-9A-Fa-f]{2})') {
        throw 'MONGODB_TEST_URI contains malformed URI encoding.'
    }

    try {
        $parsed = [Uri]$Uri
    }
    catch {
        throw 'MONGODB_TEST_URI is malformed.'
    }

    if ($parsed.Scheme -ne 'mongodb' -or
        $parsed.Host -ne '127.0.0.1' -or
        $parsed.Port -ne 27018 -or
        $parsed.Fragment -ne '') {
        throw 'MONGODB_TEST_URI does not target the approved MongoDB endpoint.'
    }

    $path = $parsed.AbsolutePath
    if ($path -notmatch '^/[^/]+$') {
        throw 'MONGODB_TEST_URI must contain exactly one database path segment.'
    }

    try {
        $databaseName = [Uri]::UnescapeDataString($path.Substring(1))
    }
    catch {
        throw 'MONGODB_TEST_URI contains an invalid database path.'
    }

    if ($databaseName -ne 'campusflow_test') {
        throw 'MONGODB_TEST_URI does not target the approved test database.'
    }

    $query = $parsed.Query.TrimStart('?')
    if ([string]::IsNullOrEmpty($query)) {
        throw 'MONGODB_TEST_URI is missing required query parameters.'
    }

    $pairs = $query -split '&'
    if ($pairs.Count -ne 2) {
        throw 'MONGODB_TEST_URI contains unexpected or duplicate query parameters.'
    }

    $parameters = @{}
    foreach ($pair in $pairs) {
        $parts = $pair -split '=', 2
        if ($parts.Count -ne 2 -or
            [string]::IsNullOrEmpty($parts[0]) -or
            $parameters.ContainsKey($parts[0])) {
            throw 'MONGODB_TEST_URI contains unexpected or duplicate query parameters.'
        }

        try {
            $key = [Uri]::UnescapeDataString($parts[0].Replace('+', ' '))
            $value = [Uri]::UnescapeDataString($parts[1].Replace('+', ' '))
        }
        catch {
            throw 'MONGODB_TEST_URI contains malformed query encoding.'
        }

        if ($parameters.ContainsKey($key)) {
            throw 'MONGODB_TEST_URI contains duplicate query parameters.'
        }
        $parameters[$key] = $value
    }

    if ($parameters.Count -ne 2 -or
        -not $parameters.ContainsKey('replicaSet') -or
        -not $parameters.ContainsKey('directConnection') -or
        $parameters['replicaSet'] -ne 'rs0' -or
        $parameters['directConnection'] -ne 'true') {
        throw 'MONGODB_TEST_URI does not contain the approved replica-set settings.'
    }
}

try {
    $expectedWorkspace = 'C:\Users\subba\OneDrive\Desktop\campus-booking-platform-main\campus-booking-platform-main'
    $expectedApi = Join-Path $expectedWorkspace 'api'
    $actualWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

    if ($actualWorkspace -ne $expectedWorkspace) {
        throw 'The runner is not located in the approved workspace.'
    }
    if (-not (Test-Path -LiteralPath $expectedApi -PathType Container)) {
        throw 'The approved API directory does not exist.'
    }
    if ($env:NODE_ENV -ne 'test') {
        throw 'NODE_ENV must be set to test before invoking the runner.'
    }

    Assert-ApprovedTestUri $env:MONGODB_TEST_URI

    $testFiles = @(
        'tests/password.test.js',
        'tests/auth.test.js',
        'tests/auth-middleware.test.js'
    )

    foreach ($relativePath in $testFiles) {
        $testPath = Join-Path $expectedApi $relativePath
        if (-not (Test-Path -LiteralPath $testPath -PathType Leaf)) {
            throw "Required test file is missing: $relativePath"
        }
        $resolvedPath = (Get-Item -LiteralPath $testPath).FullName
        if ($resolvedPath -ne $testPath) {
            throw "Required test path does not match the approved path: $relativePath"
        }
    }

    $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $nodeCommand) {
        throw 'Node.js executable was not found.'
    }

    Set-Location -LiteralPath $expectedApi
    & $nodeCommand.Source '--test' '--test-timeout=120000' $testFiles
    $nodeExitCode = $LASTEXITCODE
    exit $nodeExitCode
}
catch {
    Fail $_.Exception.Message
}
