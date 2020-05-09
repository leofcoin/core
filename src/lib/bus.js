import EventEmitter from 'events';

class Emitter extends EventEmitter {
	constructor() {
		super();
	}
  on(event, func) {
    // EventEmitter returns heavy object that we don't want to
    // send over the wire.
    super.on(event, func);
  }

  emit(event, value) {
    // EventEmitter returns heavy object that we don't want to
    // send over the wire.
    super.emit(event, value);
  }
}

export default new Emitter();
