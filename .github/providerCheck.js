
module.exports = async (github, context, core) => {

  console.log(process.cwd())
  console.log(__dirname)
  console.log(`${__dirname}/../server/src/registry.js`)
  const fs = require('fs')
  const Registry = require(`${__dirname}/../server/src/registry.js`)

  const providers = await Registry.instance.getProvidersFromApi()
  const providersJson = JSON.parse(fs.readFileSync("./server/src/data/providers.json"))

  const providersMap = providers.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})
  const providersJsonMap = providersJson.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})

  delete providersJsonMap['hashicorp/azurerm']
  delete providersMap['hashicorp/azurerm']

  const addedProviders = providers.filter(provider => !(provider.identifier in providersJsonMap))
  const deletedProviders = providersJson.filter(provider => !(provider.identifier in providersMap))

  if (addedProviders.length > 0 || deletedProviders.length > 0) {
    console.log('Changes in offical/partner providers detected!')

    await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: "(Automated) (TEST) Terraform official/partner provider changes detected.",
      body: [
        "## The following provider changes have been detected: ",
        addedProviders.map(provider => `- Added '${provider.identifier}'`),
        deletedProviders.map(provider => `- Deleted '${provider.identifier}'`)
      ].flat().join('\n')
    })

  }

}

