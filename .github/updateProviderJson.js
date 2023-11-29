
module.exports = async (github, context, core) => {

  const fs = require('fs')
  const Registry = require(`${__dirname}/../server/src/registry.js`)

  const filePaths = {
    providerJson: `${__dirname}/../server/src/data/providers.json`,
    packageJson: `${__dirname}/../package.json`,
    changelog: `${__dirname}/../CHANGELOG.md`
  }

  const providers = await Registry.instance.getProvidersFromApi()
  const providersOld = JSON.parse(fs.readFileSync(filePaths.providerJson, 'UTF-8'))

  const providersMap = providers.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})
  const providersOldMap = providersOld.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})
  const addedProviders = providers.filter(provider => !(provider.identifier in providersOldMap))
  const deletedProviders = providersOld.filter(provider => !(provider.identifier in providersMap))



  fs.writeFileSync(filePaths.providerJson, JSON.stringify(providers, null, 2), 'UTF-8')


  const packageJson = JSON.parse(
    fs.readFileSync(filePaths.packageJson, 'UTF-8')
  )
  const count = parseInt(packageJson.version.split('.')[2]) + 1
  packageJson.version = `0.0.${count}`
  fs.writeFileSync(filePaths.packageJson, JSON.stringify(packageJson, null, 4), 'UTF-8')


  let changeLog = [
    `## [${packageJson.version}]`,
    '',
    '### Update',
    ''
  ].concat(
    addedProviders.map(entry => {
      `- Add new ${entry.tier}-provider [${entry.identifier}](${entry.source})`
    })
  ).concat(
    deletedProviders.map(entry => {
      `- Deleted ${entry.tier}-provider [${entry.identifier}](${entry.source})`
    })
  )

  console.log(changeLog)
  console.log(addedProviders)
  console.log(deletedProviders)

  changeLog = changeLog.join('\n') + "\n\n" + fs.readFileSync(filePaths.changelog, 'UTF-8')

  fs.writeFileSync(filePaths.changelog, changeLog, 'UTF-8')

}

