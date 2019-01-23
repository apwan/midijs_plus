var Stream = Stream || (module && require && require('./stream').Stream);

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



if(typeof module!='undefined'){
	(function(t){	
		t.MidiFile = MidiFile;
		t.MidiWriter = MidiWriter;
		t.simpEvent = simpEvent;
		t.simpMidi = simpMidi;
	})(module.exports);
}