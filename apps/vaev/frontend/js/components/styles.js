const material_symbols = new CSSStyleSheet();

material_symbols.replaceSync(`
    @font-face {
        font-family: "Material Symbols";
        font-style: normal;
        font-weight: 400;
        src: url("/MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].ttf");
    }
    .material-symbols {
        font-family: "Material Symbols";
        font-weight: normal;
        font-style: normal;
        display: inline-block;
        line-height: 1;
        text-transform: none;
        letter-spacing: normal;
        word-wrap: normal;
        white-space: nowrap;
        direction: ltr;
        font-size: 1.5em;
        font-variation-settings: "GRAD" 100;
    }
    .fill {
        font-variation-settings: "FILL" 1;
    }
`)

const inputs = new CSSStyleSheet();

inputs.replaceSync(`
    button {
        cursor: pointer;
    }

    input,
    select,
    textarea {
        background-color: var(--background-primary);
        color: var(--text-primary);
        padding: .5rem;
        border-radius: var(--border-radius-small);
        border: var(--small-border);
        margin: 0;
        box-sizing: border-box;
    }

    input, label {
        display: block;
        width: 100%;
    }
`)

export { material_symbols, inputs };
