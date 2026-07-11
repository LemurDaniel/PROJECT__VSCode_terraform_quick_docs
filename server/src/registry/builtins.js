// Resources/functions the language itself provides, without a backing provider.

const builtinResource = {
    "terraform_data": {
        isBuiltin: true,
        docsUrl: "https://developer.hashicorp.com/terraform/language/resources/terraform-data"
    },
    "terraform_remote_state": {
        isBuiltin: true,
        docsUrl: "https://developer.hashicorp.com/terraform/language/state/remote-state-data"
    }
}

const builtInProviderFunctions = {
    "terraform::encode_tfvars": {
        isBuiltin: true,
        docsUrl: "https://developer.hashicorp.com/terraform/language/functions/terraform-encode_tfvars"
    },
    "terraform::decode_tfvars": {
        isBuiltin: true,
        docsUrl: "https://developer.hashicorp.com/terraform/language/functions/terraform-decode_tfvars"
    },
    "terraform::encode_expr": {
        isBuiltin: true,
        docsUrl: "https://developer.hashicorp.com/terraform/language/functions/terraform-encode_expr"
    }
}

module.exports = { builtinResource, builtInProviderFunctions }
