import { RichEmbed } from 'discord.js'

const COMMANDS_PER_PAGE = 5

export default function load({registerCommand: register, getCommands}) {
  register('help', 'Displays this help message', (bot, message, args) => {
    const embed = new RichEmbed()
      .setTitle('6v6 - Commands')
      .setColor(0xA94AE8)
      .setTimestamp()

    const commands = getCommands()
    const commandNames = Object.keys(commands)

    if (commandNames.length === 0) {
      return
    }

    const maxPage = Math.max(commandNames.length / COMMANDS_PER_PAGE, 1)
    const page = Math.max(Math.min(Number(args[0]) || 1, maxPage), 1)

    embed.setFooter('page ' + page + ' of ' + maxPage, 'https://cdn.discordapp.com/embed/avatars/0.png')

    const lastCommand = Math.min(page * COMMANDS_PER_PAGE, commandNames.length)
    for (let i = (page - 1) * COMMANDS_PER_PAGE; i < lastCommand; i++) {
      const cmd = commandNames[i]
      embed.addField('!' + cmd, commands[cmd].helpText, false)
    }

    message.channel.send({embed})
  })
}
