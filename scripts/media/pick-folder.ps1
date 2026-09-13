Add-Type -AssemblyName System.Windows.Forms

$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select a media folder for Averia"
$dialog.ShowNewFolderButton = $false

try {
  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::Write($dialog.SelectedPath)
  }
} finally {
  $dialog.Dispose()
  $owner.Dispose()
}
