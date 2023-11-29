
module.exports = async (github, context, core) => {

  const fs = require('fs')
  const Registry = require(`${__dirname}/../server/src/registry.js`)

  const filePaths = {
    providerJson: `${__dirname}/../server/src/data/providers.json`,
    packageJson: `${__dirname}/../package.json`,
    changelog: `${__dirname}/../CHANGELOG.md`
  }

  const providers = await registry.instance.getProvidersFromApi()
  fs.writeFileSync(filePaths.providerJson, JSON.stringify(providers), 'UTF-8')



  const packageJson = JSON.parse(
    fs.readFileSync(filePaths.packageJson, 'utf-8')
  )
  const count = parseInt(packageJson.version.split('.')[2]) + 1
  packageJson.version = `0.0.${count}`

  fs.writeFileSync(filePaths.packageJson, JSON.stringify(packageJson), 'utf-8')



  const changeLog = fs.readFileSync(filePaths.changelog, 'utf-8')
  fs.writeFileSync(filePaths.changelog, changeLog, 'utf-8')

}

