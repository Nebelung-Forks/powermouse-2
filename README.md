# Powermouse
## Powerful http(s) web proxy and flagship TitaniumNetwork proxy
#### Maintained by Divide#1335 on Discord

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/titaniumnetwork-dev/powermouse)

[![Run on Repl.it](https://repl.it/badge/github/titaniumnetwork-dev/powermouse)](https://repl.it/github/titaniumnetwork-dev/powermouse)

[!Deploy to Azure(https://azuredeploy.net/deploybutton.png)](https://azuredeploy.net/repository=https://github.com/titaniumnetwork-dev/powermouse)

Installation:
1. Download repo as a zip
2. Extract to an accessible place (eg. your desktop or home directory)
3. Open a terminal
Windows: press start menu => search for cmd.exe => open the terminal box => type "cd " in terminal then drag accessible folder into terminal and hit enter
Linux: ctrl+alt+t navigate to folder
4. Type the following command into your terminal then press enter `npm install`
5. If all packages were successfully installed, you will see no errors returned
Once the installation is complete, in your terminal you can run `node app` or `npm start` to start the proxy
The page will be available at http://127.0.0.1:8080/ or whatever you set it to in the config.json file
If you want a valid ssl certificate you can visit https://www.ssl.com/online-csr-and-key-generator/ or use letsencrypt and get some certificates for your domain and replace cert.pem and key.pem in ssl/ accordingly

Licensed under [GNU General Public License v3.0](LICENSE)
