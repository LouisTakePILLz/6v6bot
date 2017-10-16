export default function load({registerCommand: register, registerRaw: onMsg}) {
  onMsg((bot, message) => {
    const { content, author } = message;

    if (author.bot) {
      return;
    }

    if (content.trim().includes('6v6')) {
      bot.sendMessage(message, "v6v?");
    }

    if (content.trim().includes('v6v')) {
      bot.sendMessage(message, "6v6?");
    }
  });
};
