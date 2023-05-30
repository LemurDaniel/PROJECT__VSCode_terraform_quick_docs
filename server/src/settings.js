

class Settings {


    // Correlates to the settings
    static recursionDepth = 10
    static ignoreVersion = true
    static supporOtherModuleSource = true

    // Found via analyzing terraform files
    static requiredProvidersAtPath = {}

    static clientConnection = null
}


module.exports = Settings