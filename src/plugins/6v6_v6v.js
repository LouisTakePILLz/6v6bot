export default function load({registerCommand: register, registerRaw: onMsg}) {
  onMsg((bot, message, command) => {
    const { author } = message;

    if (author.bot) {
      return
    }

    if (command) {
      return
    }

    const content = message.content.toLowerCase().trim()

    if (content.includes('6v6')) {
      bot.sendMessage(message, 'v6v?')
    } else if (content.includes('v6v')) {
      bot.sendMessage(message, '6v6?')
    }
  })
}
