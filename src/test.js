var TEST = TEST || {};

// test case

TEST.testStream = function (){
	
	var r = Stream('abcdefghijklmn12');
	var w = Stream();
	while(!r.eof()){
		w.writeInt32(r.readInt32());
	}
	if(r.readAll() == w.readAll()){
		console.log('PASS: writeInt32');
	}else{
		console.log('Fail: writeInt32', w.readAll());
		return false;
	}

	r.reset();
	w = Stream();
	while(!r.eof()){
		w.writeInt16(r.readInt16());
	}
	if(r.readAll() == w.readAll()){
		console.log('PASS: writeInt16');
	}else{
		console.log('Fail: writeInt16', w.readAll());
		return false;
	}

	w = Stream();
	w.writeVarInt(0x8FFF);
	w.writeInt8(0x1F);
	w.writeVarInt(0x76FF32);
	r = Stream(w.readAll());
	if(r.readVarInt() == 0x8FFF  && r.readInt8(true) == 0x1F && r.readVarInt() == 0x76FF32){
		console.log('PASS: writeVarInt');
	}else{
		console.log('Fail: writeVarInt', w.readAll(), r.readAll());
		return false;
	}

	return true;
}

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


TEST.testMidiPlayer = function (){
	var m = new simpMidi();
	for(var i=0;i<10;++i){
		m.addEvent(0,'noteOn', 0, [60+i*2, 100]);
	    m.addEvent(500,'noteOff', 0, [60+i*2, 0]);

	}
	m.finish();
	MIDI.Player.loadFile('sample.mid', function(){
		TEST.testMidi(MIDI.Player.currentData);
		//MIDI.Player.start();
		MIDI.setMidi(m,true);
	});
	return TEST.testMidi(m);
}