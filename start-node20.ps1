# Runs the dev server with portable Node 20 (Node 24 crashes react-scripts 5 with ECONNRESET).
$node20 = "$env:USERPROFILE\tools\node20"
$env:PATH = "$node20;$env:PATH"
node -v
yarn start
