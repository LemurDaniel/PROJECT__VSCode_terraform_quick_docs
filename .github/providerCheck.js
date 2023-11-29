
module.exports = async (github, context, core) => {

  return ''

  console.log(process.cwd())
  console.log(__dirname)
  console.log(`${__dirname}/../server/src/registry.js`)

  const fs = require('fs')
  const Registry = require(`${__dirname}/../server/src/registry.js`)


  const providers = await Registry.instance.getProvidersFromApi(false)
  const providersJson = JSON.parse(fs.readFileSync("./server/src/data/providers.json"))

  const providersMap = providers.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})
  const providersJsonMap = providersJson.map(provider => ({ [provider.identifier]: provider })).reduce((accumulator, provider) => ({ ...accumulator, ...provider }), {})

  const addedProviders = providers.filter(provider => !(provider.identifier in providersJsonMap))
  const deletedProviders = providersJson.filter(provider => !(provider.identifier in providersMap))

  if (addedProviders.length == 0 && deletedProviders.length == 0) {
    console.log('No changes have been detected.')
    return ''
  }

  console.log('Changes in offical/partner providers detected!')
  const issue = await github.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: "(Automated) Terraform official/partner provider changes detected.",
    body: [
      "## The following provider changes have been detected: ",
      addedProviders.map(provider => `- Added '${provider.identifier}' as a(n) '${provider.tier}'-Provider`),
      deletedProviders.map(provider => `- Deleted '${provider.identifier} as a(n) '${provider.tier}'-Provider'`)
    ].flat().join('\n')
  })

  console.log(issue)

  return issue.data.number

}

