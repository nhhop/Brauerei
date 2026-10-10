import { render } from 'preact';
import { App } from './app';
import './styles.css';
import { installLinkRouting } from './linkRouting';

installLinkRouting();

render(<App />, document.getElementById('app')!);
