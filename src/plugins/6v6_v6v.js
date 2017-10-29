export default function load({ registerRaw: onMsg }) {
  onMsg((bot, message, command) => {
    const { author } = message

    if (author.bot) {
      return
    }

    if (command) {
      return
    }

    const content = message.content.toLowerCase().trim()

    if (content.includes('6v6')) {
      message.channel.send('v6v?')
    } else if (content.includes('v6v')) {
      message.channel.send('6v6?')
    }
  })
}
