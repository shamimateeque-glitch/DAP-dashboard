
Remove-Item -Recurse -Force 'C:UsersErumAppDataLocalTempdocx_extract_tmp' -ErrorAction SilentlyContinue
Copy-Item -Path 'C:UsersErumDocumentsmidnight-glow-dashboard-main.4-Complete List of Reports.docx' -Destination 'C:UsersErumAppDataLocalTempeports_doc.zip'
Expand-Archive -Path 'C:UsersErumAppDataLocalTempeports_doc.zip' -DestinationPath 'C:UsersErumAppDataLocalTempdocx_extract_tmp' -Force
