

class Settings {


    // Correlates to the settings
    static recursionDepth = 10
    static ignoreVersion = true
    static supportOtherModuleSource = true

    // Found via analyzing terraform files
    static terraformBlock = {}

    static clientConnection = null
}


module.exports = Settings