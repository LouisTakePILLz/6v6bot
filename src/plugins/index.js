import bulk from 'bulk-require';

const modules = bulk(__dirname, ['./**/!(*index|*.spec).js']);

const plugins = [];

Object.keys(modules).forEach((key) => {
    let item = modules[key].default;
    plugins.push(item);
});

export default plugins;
