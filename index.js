LIBRARIES = {
    FS: require("fs"), // This library allows you to interact with local files on the machine.
    Colors: require("colors"), // This library allows you to colorize the console outputs.
    ChildProcess: require("child_process"), // This library allows you to execute terminal code on the local station.
    ReadLine: require("readline"), // This library allows you to query the user in the terminal.
    SocketIO: require("socket.io"), // This library allows you to design a socket server.
    Path: require("path") // This library allows you to create paths without having to worry about the computer OS.
};

class Launcher {
    Demo_mode = false;

    constructor() {
        const SELF = this;

        if(process.argv[2] != undefined){
          if(process.argv[2] == "demo"){
            SELF.Demo_mode = true;
          }
        }

        SELF.GitClientURL = "https://github.com/HeyHeyChicken/NOVA-Client.git";
        SELF.GitServerURL = "https://github.com/HeyHeyChicken/NOVA-Server.git";

        SELF.ClientPath = LIBRARIES.Path.join(__dirname, "/src/client");
        SELF.ServerPath = LIBRARIES.Path.join(__dirname, "/src/server");

        SELF.Settings = JSON.parse(LIBRARIES.FS.readFileSync(__dirname + "/settings.json", "utf8"));
        SELF.SocketServer = null;

        if(SELF.Demo_mode){
          SELF.Settings.LaunchClientOnStart = true;
          SELF.Settings.LaunchServerOnStart = true;
          SELF.Settings.Debug = false;
        }

        console.log("######################################");
        console.log("##                                  ##");
        console.log("##  Welcome to MONDAY's launcher !  ##");
        console.log("##                                  ##");
        console.log("######################################");

        SELF.CheckLicense();
        SELF.InitialiseSocketServer();

        SELF.CheckLaunchClientOnStartSettings(function(){
            SELF.CheckLaunchServerOnStartSettings(function(){
                SELF.Launch(SELF.Settings.LaunchServerOnStart, SELF.ServerPath, SELF.GitServerURL, "MONDAY - Server", function(){
                    SELF.InstallPackages(SELF.Settings.LaunchServerOnStart, SELF.ServerPath, "MONDAY - Server", function () {
                        SELF.Launch(SELF.Settings.LaunchClientOnStart, SELF.ClientPath, SELF.GitClientURL, "MONDAY - Client", function(){
                            SELF.InstallPackages(SELF.Settings.LaunchClientOnStart, SELF.ClientPath, "MONDAY - Client", function () {
                                if(SELF.Settings.LaunchServerOnStart === true){
                                    SELF.Log("Starting the server ...", "green");
                                    SELF.Terminal("node index.js", SELF.ServerPath);
                                }
                                if(SELF.Settings.LaunchClientOnStart === true){
                                    SELF.Log("Starting the client ...", "green");
                                    SELF.Terminal("node index.js", SELF.ClientPath);
                                }
                            });
                        });
                    });
                });
            });
        });
    }

    // This function initializes the socket server connecting the launcher to the NOVA server.
    InitialiseSocketServer(){
        const SELF = this;

        this.SocketServer = LIBRARIES.SocketIO();
        this.SocketServer.on("connection", function(socket){ // A server has just connected to the launcher.
            // If the server requests the launcher to display text in the console.
            socket.on("log", function(_text, _color, _header){
                SELF.Log(_text, _color, _header);
            });

            // If the server asks the launcher to restart.
            socket.on("reboot_server", function(){
                SELF.Log("Rebooting the server...", "green");
                socket.emit("reboot");

                setTimeout(function(){
                    if(SELF.Settings.LaunchServerOnStart === true){
                        SELF.Terminal("node index.js", SELF.ServerPath);
                    }
                }, 1000);
            });

            // If the client asks the launcher to restart.
            socket.on("reboot_client", function(){
                SELF.Log("Rebooting the client...", "green");
                socket.emit("reboot");

                setTimeout(function(){
                    if(SELF.Settings.LaunchClientOnStart === true){
                        SELF.Terminal("node index.js", SELF.ClientPath);
                    }
                }, 1000);
            });
        });

        this.SocketServer.listen(8082);
    }

    // This function installs the required packages to run the application.
    InstallPackages(_settings, _path, _name, _callback){
        const SELF = this;

        if(_settings === true) {
            SELF.Terminal("npm install", _path, function (_error_code, _messages) {
                if (_error_code === 0) {
                    SELF.Log("Your \"" + _name + "\" app's packages are installed.", "green");

                    if (_callback !== undefined) {
                        _callback();
                    }
                } else {
                    console.log("npm install error : " + _error_code);
                }
            });
        }
        else{
            if (_callback !== undefined) {
                _callback();
            }
        }
    }

    // This function launches an instance of NOVA.
    Launch(_settings, _path, _git, _name, _callback){
        const SELF = this;

        if(_settings === true){
            if (!LIBRARIES.FS.existsSync(_path)) {
                SELF.Log("It seems that you don't have \"" + _name + "\" installed, we are downloading it.", "purple");
                SELF.Terminal("git --version", null, function(_error_code, _messages){
                    if(_error_code === 0){
                        SELF.Terminal("git clone " + _git + " \"" + _path + "\"", null, function(_error_code, _messages){
                            if(_error_code === 0){
                                SELF.Log("The download went well.", "green");
                                if(_callback !== undefined){
                                    _callback();
                                }
                            }
                        });
                    }
                });
            }
            else{
                const UP_TO_DATE = "Your \"" + _name + "\" app seems to be up to date.";
                const NEW_VERSION = "A new version of \"" + _name + "\" is available.";
                if(SELF.Settings.UpdateAtBoot === true){
                    SELF.CheckUpdate(_path, function(_updateAvailable){
                        if(_updateAvailable === true){
                            SELF.Log(UP_TO_DATE, "green");
                            if(_callback !== undefined){
                                _callback();
                            }
                        }
                        else{
                            SELF.Log(NEW_VERSION, "red");
                            SELF.Log("Because \"UpdateAtBoot\" is set to \"true\", we are starting the update.", "purple");
                            SELF.Update(_path, function(){
                                if(_callback !== undefined){
                                    _callback();
                                }
                            });
                        }
                    });
                }
                else{
                    SELF.CheckUpdate(_path, function(_updateAvailable){
                        if(_updateAvailable === true){
                            SELF.Log(UP_TO_DATE, "green");
                        }
                        else{
                            SELF.Log(NEW_VERSION, "red");
                        }
                    });
                    if(_callback !== undefined){
                        _callback();
                    }
                }
            }
        }
        else{
            if(_callback !== undefined){
                _callback();
            }
        }
    }

    // This function asks the user whether or not to start a client when starting the launcher.
    CheckLaunchClientOnStartSettings(_callback){
        const SELF = this;

        if(SELF.Settings.LaunchClientOnStart === null){
            SELF.AskQuestion("Do you want the launcher to auto start a client ? (Y/n)", function(_answer){
                if(_answer.toLowerCase() === "y" || _answer.toLowerCase() === "yes" || _answer === ""){
                    SELF.Settings.LaunchClientOnStart = true;
                }
                else{
                    SELF.Settings.LaunchClientOnStart = false;
                }
                LIBRARIES.FS.writeFileSync(__dirname + "/settings.json", JSON.stringify(SELF.Settings, null, 4), "utf8");
                _callback();
            });
        }
        else{
            _callback();
        }
    }

    // This function asks the user whether or not to start a server when starting the launcher.
    CheckLaunchServerOnStartSettings(_callback){
        const SELF = this;

        if(SELF.Settings.LaunchServerOnStart === null){
            SELF.AskQuestion("Do you want the launcher to auto start a server ? (Y/n)", function(_answer){
                if(_answer.toLowerCase() === "y" || _answer.toLowerCase() === "yes" || _answer === ""){
                    SELF.Settings.LaunchServerOnStart = true;
                }
                else{
                    SELF.Settings.LaunchServerOnStart = false;
                }
                LIBRARIES.FS.writeFileSync(__dirname + "/settings.json", JSON.stringify(SELF.Settings, null, 4), "utf8");
                _callback();
            });
        }
        else{
            _callback();
        }
    }

    // This function updates NOVA.
    Update(_path, _callback){
        const SELF = this;

        SELF.Log("Updating...", "green");
        SELF.Terminal("git pull", _path, function(_error_code, _messages){
            if(_error_code === 0){
                SELF.Log("The update went well.", "green");

                if(_callback !== undefined){
                    _callback();
                }
            }
            else{
                console.log("git pull : " + _error_code);
            }
        });
    }

    // This function checks for updates.
    CheckUpdate(_path, _callback){
        const SELF = this;

        SELF.Terminal("git fetch origin", _path, function(_error_code, _messages){
            if(_error_code === 0){
                SELF.Terminal("git status", _path, function(_error_code, _messages){
                    if(_error_code === 0){
                        if(_messages.includes("Your branch is up to date with 'origin/master'.")){
                            if(_callback !== undefined){
                                _callback(true);
                            }
                        }
                        else {
                            _callback(false);
                        }
                    }
                });
            }
        });
    }

    // This function executes terminal commands on the local computer.
    Terminal(_command, _path, _callback){
        const SELF = this;

        const MESSAGES = [];
        const EXECUTION = LIBRARIES.ChildProcess.exec(_command, { cwd: _path });

        if(SELF.Settings.Debug === true){
            SELF.Log("Command : " + _command);
        }

        EXECUTION.stdout.on("data", (_data) => {
            _data = _data.split("\n");
            for(let i = 0; i < _data.length; i++){
                if(_data[i].length > 0){
                    MESSAGES.push(_data[i]);
                    if(SELF.Settings.Debug === true){
                        SELF.Log(_data[i]);
                    }
                }
            }
        });

        EXECUTION.stderr.on("data", (_data) => {
            _data = _data.split("\n");
            for(let i = 0; i < _data.length; i++){
                if(_data[i].length > 0){
                    MESSAGES.push(_data[i]);
                    if(SELF.Settings.Debug === true){
                        SELF.Log(_data[i]);
                    }
                }
            }
        });

        EXECUTION.on("close", (_error_code) => {
            if(_callback !== undefined){
                _callback(_error_code, MESSAGES);
            }
        });
    }

    // This function asks the user a question from the command prompt.
    AskQuestion(_question, _callback) {
        this.Log(_question, "green");
        const RL = LIBRARIES.ReadLine.createInterface({
            input: process.stdin
        });

        return new Promise(resolve => RL.question(_question, function(_answer) {
            RL.close();
            if(_callback !== undefined){
                _callback(_answer);
            }
        }));
    }

    // This function checks the license.
    CheckLicense() {
        if(this.Settings.LicenseKey !== "non-commercial-and-evaluation"){
            this.Log("Your license key is invalid.", "red");
            process.exit();
        }
    }

    // This function replaces the "console.log" function.
    Log(_text, _color = "green", _header = "MONDAY LAUNCHER"){
        if(_text.length > 0){
            if(LIBRARIES.Colors[_color] !== undefined){
                console.log("[" + (LIBRARIES.Colors[_color](_header)) + "] " + _text);
            }
            else{
                console.log(LIBRARIES.Colors.red("The color \"" + _color + "\" does not exist in the \"colors\" package."));
            }
        }
    }
}

const LAUNCHER = new Launcher();
