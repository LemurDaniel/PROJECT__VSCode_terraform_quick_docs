$data = Get-Content .\functions.json | ConvertFrom-Json
$data.data 
| ForEach-Object { 
    $_.data | ForEach-Object { 
        $_ | Add-Member NoteProperty description "" -Force
        $_ | Add-Member NoteProperty full "" -Force

        $_.full = Get-Content "./functions/$($_.title).mdx"
        $_.description = [regex]::Matches((Get-Content "./functions/$($_.title).mdx" -Raw), "``$($_.title)``[^\r\n]+")[1].Value
    } 
}
$data | ConvertTo-Json -Depth 99 | Out-File .\functions.json