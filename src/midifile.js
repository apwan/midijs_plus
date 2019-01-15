/*
class to parse the .mid file format
(depends on stream.js)
*/

var Stream = Stream || (module && require && require('./stream').Stream);

var MIDI = MIDI || {};

MIDI.eventCode = {
	'sequenceNumber': 0x00,
	'text': 0x01,
	'copyrightNotice': 0x02,
	'trackName': 0x03,
	'instrumentName': 0x04,
	'lyrics': 0x05,
	'marker': 0x06,
	'cuePoint': 0x07,
	'midiChannelPrefix': 0x20,
	'endOfTrack': 0x2f,
	'setTempo': 0x51,
	'smpteOffset': 0x54,
	'timeSignature': 0x58,
	'keySignature': 0x59,
	'sequencerSpecific': 0x7f,
	'unknown': 0xff,
	'meta': 0xff,
	'sysEx': 0xf0,
	'dividedSysEx': 0xf7,

	'noteOff': 0x08,
	'noteOn': 0x09,
	'noteAftertouch': 0x0a,
	'controller': 0x0b,
	'programChange': 0x0c,
	'channelAftertouch': 0x0d,
	'pitchBend': 0x0e,
}

function MidiFile(data) {
	function readChunk(stream) {
		var id = stream.read(4);
		var length = stream.readInt32();
		return {
			'id': id,
			'length': length,
			'data': stream.read(length)
		};
	}
	
	var lastEventTypeByte;
	
	function readEvent(stream) {
		var event = {};
		event.deltaTime = stream.readVarInt();
		var eventTypeByte = stream.readInt8();
		if ((eventTypeByte & 0xf0) == 0xf0) {
			/* system / meta event */
			if (eventTypeByte == 0xff) {
				/* meta event */
				event.type = 'meta';
				var subtypeByte = stream.readInt8();
				var length = stream.readVarInt();
				switch(subtypeByte) {
					case 0x00:
						event.subtype = 'sequenceNumber';
						if (length != 2) throw "Expected length for sequenceNumber event is 2, got " + length;
						event.number = stream.readInt16();
						return event;
					case 0x01:
						event.subtype = 'text';
						event.text = stream.read(length);
						return event;
					case 0x02:
						event.subtype = 'copyrightNotice';
						event.text = stream.read(length);
						return event;
					case 0x03:
						event.subtype = 'trackName';
						event.text = stream.read(length);
						return event;
					case 0x04:
						event.subtype = 'instrumentName';
						event.text = stream.read(length);
						return event;
					case 0x05:
						event.subtype = 'lyrics';
						event.text = stream.read(length);
						return event;
					case 0x06:
						event.subtype = 'marker';
						event.text = stream.read(length);
						return event;
					case 0x07:
						event.subtype = 'cuePoint';
						event.text = stream.read(length);
						return event;
					case 0x20:
						event.subtype = 'midiChannelPrefix';
						if (length != 1) throw "Expected length for midiChannelPrefix event is 1, got " + length;
						event.channel = stream.readInt8();
						return event;
					case 0x2f:
						event.subtype = 'endOfTrack';
						if (length != 0) throw "Expected length for endOfTrack event is 0, got " + length;
						return event;
					case 0x51:
						event.subtype = 'setTempo';
						if (length != 3) throw "Expected length for setTempo event is 3, got " + length;
						event.microsecondsPerBeat = (
							(stream.readInt8() << 16)
							+ (stream.readInt8() << 8)
							+ stream.readInt8()
						)
						return event;
					case 0x54:
						event.subtype = 'smpteOffset';
						if (length != 5) throw "Expected length for smpteOffset event is 5, got " + length;
						var hourByte = stream.readInt8();
						event.frameRate = {
							0x00: 24, 0x20: 25, 0x40: 29, 0x60: 30
						}[hourByte & 0x60];
						event.hour = hourByte & 0x1f;
						event.min = stream.readInt8();
						event.sec = stream.readInt8();
						event.frame = stream.readInt8();
						event.subframe = stream.readInt8();
						return event;
					case 0x58:
						event.subtype = 'timeSignature';
						if (length != 4) throw "Expected length for timeSignature event is 4, got " + length;
						event.numerator = stream.readInt8();
						event.denominator = Math.pow(2, stream.readInt8());
						event.metronome = stream.readInt8();
						event.thirtyseconds = stream.readInt8();
						return event;
					case 0x59:
						event.subtype = 'keySignature';
						if (length != 2) throw "Expected length for keySignature event is 2, got " + length;
						event.key = stream.readInt8(true);
						event.scale = stream.readInt8();
						return event;
					case 0x7f:
						event.subtype = 'sequencerSpecific';
						event.data = stream.read(length);
						return event;
					default:
						// console.log("Unrecognised meta event subtype: " + subtypeByte);
						event.subtype = 'unknown'
						event.data = stream.read(length);
						return event;
				}
				event.data = stream.read(length);
				return event;
			} else if (eventTypeByte == 0xf0) {
				event.type = 'sysEx';
				var length = stream.readVarInt();
				event.data = stream.read(length);
				return event;
			} else if (eventTypeByte == 0xf7) {
				event.type = 'dividedSysEx';
				var length = stream.readVarInt();
				event.data = stream.read(length);
				return event;
			} else {
				throw "Unrecognised MIDI event type byte: " + eventTypeByte;
			}
		} else {
			/* channel event */
			var param1;
			if ((eventTypeByte & 0x80) == 0) {
				/* running status - reuse lastEventTypeByte as the event type.
					eventTypeByte is actually the first parameter
				*/
				param1 = eventTypeByte;
				eventTypeByte = lastEventTypeByte;
			} else {
				param1 = stream.readInt8();
				lastEventTypeByte = eventTypeByte;
			}
			var eventType = eventTypeByte >> 4;
			event.channel = eventTypeByte & 0x0f;
			event.type = 'channel';
			switch (eventType) {
				case 0x08:
					event.subtype = 'noteOff';
					event.noteNumber = param1;
					event.velocity = stream.readInt8();
					return event;
				case 0x09:
					event.noteNumber = param1;
					event.velocity = stream.readInt8();
					if (event.velocity == 0) {
						event.subtype = 'noteOff';
					} else {
						event.subtype = 'noteOn';
					}
					return event;
				case 0x0a:
					event.subtype = 'noteAftertouch';
					event.noteNumber = param1;
					event.amount = stream.readInt8();
					return event;
				case 0x0b:
					event.subtype = 'controller';
					event.controllerType = param1;
					event.value = stream.readInt8();
					return event;
				case 0x0c:
					event.subtype = 'programChange';
					event.programNumber = param1;
					return event;
				case 0x0d:
					event.subtype = 'channelAftertouch';
					event.amount = param1;
					return event;
				case 0x0e:
					event.subtype = 'pitchBend';
					event.value = param1 + (stream.readInt8() << 7);
					return event;
				default:
					throw "Unrecognised MIDI event type: " + eventType
					/* 
					console.log("Unrecognised MIDI event type: " + eventType);
					stream.readInt8();
					event.subtype = 'unknown';
					return event;
					*/
			}
		}
	}
	
	var stream = Stream(data);
	var headerChunk = readChunk(stream);
	if (headerChunk.id != 'MThd' || headerChunk.length != 6) {
		throw "Bad .mid file - header not found";
	}
	var headerStream = Stream(headerChunk.data);
	var formatType = headerStream.readInt16();
	var trackCount = headerStream.readInt16();
	var timeDivision = headerStream.readInt16();
	
	if (timeDivision & 0x8000) {
		throw "Expressing time division in SMTPE frames is not supported yet"
	} else {
		ticksPerBeat = timeDivision;
	}
	
	var header = {
		'formatType': formatType,
		'trackCount': trackCount,
		'ticksPerBeat': ticksPerBeat
	}
	var tracks = [];
	for (var i = 0; i < header.trackCount; i++) {
		tracks[i] = [];
		var trackChunk = readChunk(stream);
		if (trackChunk.id != 'MTrk') {
			throw "Unexpected chunk - expected MTrk, got "+ trackChunk.id;
		}
		var trackStream = Stream(trackChunk.data);
		while (!trackStream.eof()) {
			var event = {};
			try{
				event = readEvent(trackStream);
				tracks[i].push(event);
			}catch(e){
				console.log(e,i);
			}finally{
				//console.log(event);
			}
			

		}
	}
	
	return new simpMidi(header, tracks);
}



function MidiWriter(data){

	var lastEventTypeByte = "nothing";

	var eventCode = MIDI.eventCode;
	var defaultLength = {
		'sequenceNumber': 2,
		'midiChannelPrefix': 1,
		'endOfTrack': 0,
		'setTempo': 3,
		'smpteOffset': 5,
		'timeSignature': 4,
		'keySignature': 2,
	}

    function writeEvent(event, stream){
    	stream.writeVarInt(event.deltaTime);
    	if(event.type == 'meta'){
    		stream.writeInt8(eventCode[event.type]);
    		stream.writeInt8(eventCode[event.subtype]);
    		var length = defaultLength[event.subtype] | 
    		(event.data && event.data.length) |
    		(event.text && event.text.length) ;

    		var content = Stream();
    		switch(event.subtype){
    			case 'sequenceNumber':
    			    content.writeInt16(event.number);
    			    break;
	            case 'midiChannelPrefix':
	                content.writeInt8(event.channel);
	                break;
	            case 'endOfTrack': 
	                break;
	            case 'setTempo':
	                content.writeInt8((event.microsecondsPerBeat>>16)&0xFF);
	                content.writeInt8((event.microsecondsPerBeat>>8)&0xFF);
	                content.writeInt8(event.microsecondsPerBeat&0xFF);
	                break;
	            case 'smpteOffset': 
	                var frameBits = {24:0x00, 25:0x20, 29:0x40, 30:0x60}[event.frameRate] & 0x60;
	                content.writeInt8(frameBits | (0x1f&event.hour));
	                content.writeInt8(event.min);
	                content.writeInt8(event.sec);
	                content.writeInt8(event.frame);
	                content.writeInt8(event.subframe);
	                break;
	            case 'timeSignature':
	                content.writeInt8(event.numerator);
	                content.writeInt8(Math.log2(event.denominator) >> 0);
	                content.writeInt8(event.metronome);
	                content.writeInt8(event.thirtyseconds);
	                break;
	            case 'keySignature':
	                content.writeInt8(event.key);
	                content.writeInt8(event.scale);
                    break;
    			default:

    		}
    		stream.writeVarInt(length);
    		stream.write(event.data || event.text || content.readAll());

    	}else if(event.type == 'sysEx' || event.type == 'dividedSysEx'){
    		stream.writeInt8(eventCode[event.type]);
    		stream.writeVarInt(event.data.length);
            stream.write(event.data);

    	}else if(event.type == 'channel'){
    		// channel event
    		var eventTypeByte = (eventCode[event.subtype] << 4) | (event.channel & 0x0f);
    		if(lastEventTypeByte != eventTypeByte){
    			stream.writeInt8(eventTypeByte);
    			lastEventTypeByte = eventTypeByte;
    		}
    		switch(event.subtype){
    			case 'noteOff': case 'noteOn':
    			    stream.writeInt8(event.noteNumber);
    			    stream.writeInt8(event.velocity);
    			    break;
    			case 'noteAftertouch':
    			    stream.writeInt8(event.noteNumber);
    			    stream.writeInt8(event.amount);
    			    break;
    			case 'controller':
    			    stream.writeInt8(event.controllerType);
    			    stream.writeInt8(event.value);
    			    break;
    			case 'programChange':
    			    stream.writeInt8(event.programNumber);
    			    break;
    			case 'channelAftertouch':
    			    stream.writeInt8(event.amount);
    			    break;
    			case 'pitchBend':
    			    stream.writeInt8(event.value & 0x7f);
    			    stream.writeInt8(event.value >> 7);
    			    break;
    			default:

    		}


    	}

	}

	function writeTrack(track){
		var res = Stream();
		for(var i=0;i<track.length;++i){
			writeEvent(track[i], res);
		}
		return res.readAll();
	}

	function write(d){
		var res = Stream();
		res.write('MThd');
		res.writeInt32(6);
		var header = d.header;
		var tracks = d.tracks;
		res.writeInt16(header.formatType);
		res.writeInt16(header.trackCount);
		res.writeInt16(header.ticksPerBeat);
		for(var j=0;j<tracks.length;++j){
			var t = writeTrack(tracks[j]);
			res.write('MTrk');
			res.writeInt32(t.length);
			res.write(t);
		}
		return res.readAll();
	}

	return write(data);
}



function simpEvent(deltaTime, subtype, param0, param1){
	var event = {};
	event.deltaTime = deltaTime;
	event.subtype = subtype;
	switch(subtype){
		case 'timeSignature':
		    event.type = 'meta';
		    event.numerator = param0;
	        event.denominator = param1;
	        event.metronome = 24;
	        event.thirtyseconds = 8;
	        break;
	    case 'keySignature':
	        event.type = 'meta';
	        event.key = param0;
	        event.scale = {"maj":0, "min":1}[param1]
            break;
    	case 'setTempo':
    	    event.type = 'meta';
    	    event.microsecondsPerBeat = 60000000/param0 >> 0;
    	    break;
    	case 'endOfTrack':
    	    event.type = 'meta';
    	    break;

    	case 'noteOff': case 'noteOn':
            event.type = 'channel';
            event.channel = param0;
    		event.noteNumber = param1[0];
    	    event.velocity = param1[1];
    	    break;
    	case 'programChange':
    	    event.type = 'channel';
    	    event.channel = param0;
    	    event.programNumber = param1;
    	    break;

	}
	return event;
}

function simpMidi(header, tracks){
	this.header = header || {
		'formatType': 1,
		'trackCount': 2,
		'ticksPerBeat': 500
	};
	this.tracks = tracks;
	this.getTimeSignature(); //simpEvent(0, 'timeSignature', 4,4);
    this.getKeySignature(); //simpEvent(0, 'keySignature', 0, 'maj');
    this.getTempo(); // simpEvent(0, 'setTempo', 120);
	this.tracks = this.tracks || [[
	    this.tsig,
	    this.ksig,
	    this.tempo
	],[
	    ]];

}

simpMidi.prototype.setDefaultTempo = function(tempo){
	tempo = tempo || 120;
	this.header.ticksPerBeat = Math.floor(60000/tempo);
};

simpMidi.prototype.getDefaultTempo = function(){
	return Math.floor(60000/this.header.ticksPerBeat);
}

simpMidi.prototype.getMeta = function(subtype){
	if(this.tracks == null) return null;
	var res = null;
	var track = this.tracks[0];
	for (var i = 0; i < track.length; ++i) {
		if (track[i].type == 'meta' && track[i].subtype == subtype) {
			res = track[i];
			break;
		}
	}
	return res;
}

simpMidi.prototype.getTimeSignature = function(){
	this.tsig = this.tsig || simpMidi.prototype.getMeta.call(this,'timeSignature') || simpEvent(0, 'timeSignature', 4,4);
	return [this.tsig.numerator, this.tsig.denominator];
};

simpMidi.prototype.getTempo = function(){
	// TODO: handle tempo change
	this.tempo = this.tempo || simpMidi.prototype.getMeta.call(this,'setTempo') || simpEvent(0, 'setTempo', 120);
	return 60000000/this.tempo.microsecondsPerBeat >>> 0

}

simpMidi.prototype.getKeySignature = function(){
	this.ksig = this.ksig || simpMidi.prototype.getMeta.call(this,'keySignature') || simpEvent(0, 'keySignature', 0, 'maj');
	return [this.ksig.key, this.ksig.scale];
}

simpMidi.prototype.write = function(lazy){
	return this.raw_midi = lazy? (this.raw_midi || MidiWriter(this)): MidiWriter(this);
}

simpMidi.prototype.setTimeSignature = function(n,d){
	this.tsig.numerator = n;
	this.tsig.denominator = d;
}
simpMidi.prototype.setKeySignature = function(k,m){
	this.ksig.key = k;
	this.ksig.scale = {"maj":0, "min":1}[m];
}
simpMidi.prototype.setTempo = function(t){
	this.tempo.microsecondsPerBeat = 60000000/t >>> 0;
}

simpMidi.prototype.addEvent = function(){
	var arg = Array.prototype.slice.call(arguments);
	this.tracks[arg.shift()].push(simpEvent.apply(null, arg));
}

simpMidi.prototype.finish = function(){
	for(var i=0;i<this.tracks.length;++i){
		this.tracks[i].push(simpEvent(0,'endOfTrack'));
	}
}
simpMidi.prototype.addTrack = function(){
	this.tracks.push([]);
	return this.header.trackCount = this.tracks.length;
}
simpMidi.prototype.addNotes = function(l,dur,notes,vols,rollTime,delta){
	var delta = delta || 0;
	var rollTime = rollTime || 0;
	var vols = vols || [110]
	if(typeof vols == 'number'){
		vols = [vols];
	}
	if(typeof notes == 'number'){
		notes = [notes];
	}
	if(l < 1){l = 1;}
	if(l >= this.tracks.length){ l = this.tracks.length - 1}
	var track = this.tracks[l];

	// the track l use the  channel l - 1
 	track.push(simpEvent(delta, 'noteOn', l-1, [notes[0], vols[0]]));
	notes.slice(1).forEach( function(e, i){
	    track.push(simpEvent(rollTime, 'noteOn', l-1, [e,vols[i] || vols[0]]));
	});
	track.push(simpEvent(dur-(notes.length-1)*rollTime, 'noteOn', l-1, [notes[0], 0]));
	notes.slice(1).forEach( function(e){
		track.push(simpEvent(0, 'noteOn', l-1, [e,0]));
	});

}

simpMidi.prototype.quantize = function(ctrl_per_beat){
	var ctrl_per_beat = ctrl_per_beat || 8;
	var ticks = this.header.ticksPerBeat;
	var res = [];
	for(var i=1;i<this.tracks.length;++i){
		var tmp = [];
		var delta = 0;
		this.tracks[i].forEach(function(e,i){
			if(e.type=='channel'){
				if(e.deltaTime > 0){
					delta += e.deltaTime
				}
				var tmp2 = [Math.round(delta / ticks * ctrl_per_beat)];
				switch(e.subtype){
					case 'noteOn':case 'noteOff':
						tmp2.push(e.subtype, e.noteNumber, e.velocity);
						break;
					case 'programChange':
						tmp2.push(e.subtype, e.programNumber);
						break;
					default:
						console.log(e.subtype);
						return;
				}
				tmp.push(tmp2);
			}
		});
        res.push(tmp);
	}
	return res;
};

var TEST = TEST || {};

TEST.testMidi = function(m){
	if(m==undefined) return true;
	var m1 = typeof m == 'string'? MidiFile(m): m;
	var f1 = MidiWriter(m1);
	var m2 = MidiFile(f1);
	var f2 = MidiWriter(m2);
	var m3 = MidiFile(f2);
	if(f1 == f2){
		console.log('PASS: MidiWriter',JSON.stringify(m2)==JSON.stringify(m3));
	}else{
		var diff = 0;
		while(true){
			if(f1.charCodeAt(diff) != f2.charCodeAt(diff)) break;
			diff++;
		}
		console.log('FAIL: MidiWriter', diff);
		return false;
	}
	return true;
}

if(typeof module!='undefined'){
	(function(t){	
		t.MidiFile = MidiFile;
		t.MidiWriter = MidiWriter;
		t.simpEvent = simpEvent;
		t.simpMidi = simpMidi;
	})(module.exports);
}