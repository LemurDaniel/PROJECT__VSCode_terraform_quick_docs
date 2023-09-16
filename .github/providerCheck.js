
module.exports = async (github, context, core) => {

  console.log(process.cwd())
  const fs = require('fs')
  const Registry = require('./server/src/registry')

  const providers = await Registry.getProvidersFromAPI()
  const providersJson = JSON.parse(fs.readFileSync("./server/src/data/providers.json"))

  const providersMap = providers.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})
  const providersJsonMap = providersJson.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})

  delete providersJsonMap['azurerm']
  providersMap['test/test'] =
  {
    "name": "testtest",
    "namespace": "test",
    "identifier": "test/test",
    "tier": "partner"
  }


  const addedProviders = providers.filter(provider => !(provider.identifier in providersJsonMap))
  const deletedProviders = providersJsonMap.filter(provider => !(provider.identifier in providersMap))

  if (addedProviders.length > 0 || deletedProviders.length > 0) {
    console.log('Changes in offical/partner providers detected!')

    await github.rest.issue.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: "(Automated) Terraform official/partner provider changes detected.",
      body: [
        "## The following provider changes have been detected: ",
        addedProviders.map(provider => `- Added '${provider.identifier}'`),
        deletedProviders.map(provider => `- Deleted '${provider.identifier}'`)
      ].flat().join('\n')
    })

  }

}

