const vscode = require('vscode')

// Maps a list of data entries to QuickPick items, turning any entry with a
// 'seperator' field into a QuickPick separator instead of running it through mapItem.
function toQuickPickOptions(items, mapItem) {
    return items.map(item => item.seperator
        ? { label: item.seperator, kind: vscode.QuickPickItemKind.Separator }
        : mapItem(item)
    )
}

module.exports = { toQuickPickOptions }
