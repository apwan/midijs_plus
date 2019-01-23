/* Wrapper for accessing strings through sequential reads */
// TODO: use typed array
function Stream(str) {
	var position = 0;
	var instr = str==undefined? "": str;
	
	function read(length) {
		var result = instr.substr(position, length);
		position += length;
		return result;
	}
	function write(s){
		instr += s;
		return position += s.length;
	}
	
	/* read a big-endian 32-bit integer */
	function readInt32() {
		var result = (
			(instr.charCodeAt(position) << 24)
			+ (instr.charCodeAt(position + 1) << 16)
			+ (instr.charCodeAt(position + 2) << 8)
			+ instr.charCodeAt(position + 3));
		position += 4;
		return result;
	}
	function writeInt32(i){
		instr += String.fromCharCode((i>>24)&0xFF,(i>>16)&0xFF,(i>>8)&0xFF,i&0xFF);
		return position += 4;
	}

	/* read a big-endian 16-bit integer */
	function readInt16() {
		var result = (
			(instr.charCodeAt(position) << 8)
			+ instr.charCodeAt(position + 1));
		position += 2;
		return result;
	}
	function writeInt16(i){
        instr += String.fromCharCode((i>>8)&0xFF,i&0xFF);
		return position += 2;
	}
	
	/* read an 8-bit integer */
	function readInt8(signed) {
		var result = instr.charCodeAt(position);
		if (signed && result > 127) result -= 256;
		position += 1;
		return result;
	}
	function writeInt8(i){
        instr += String.fromCharCode(i&0xFF);
        return position += 1;
	}
	
	function eof() {
		return position >= instr.length;
	}
	
	/* read a MIDI-style variable-length integer
		(big-endian value in groups of 7 bits,
		with top bit set to signify that another byte follows)
	*/
	function readVarInt() {
		var result = 0;
		while (true) {
			var b = readInt8();
			if (b & 0x80) {
				result += (b & 0x7f);
				result <<= 7;
			} else {
				/* b is the last byte */
				return result + b;
			}
		}
	}
	function writeVarInt(i){
		var ret = String.fromCharCode(i&0x7F);
		while(i>0x7F){
			i >>= 7;
            ret = String.fromCharCode(0x80|(i&0x7F)) + ret;
		}
		instr += ret;
		return position += ret.length;
	}
    function reset(){
    	position = 0;
    	instr = "";
    }
	function readAll(){
		return instr;
	}
	function pos(){
		return position;
	}

	if(typeof str == "string"){
		return {
			'eof': eof,
			'read': read,
			'readInt32': readInt32,
			'readInt16': readInt16,
			'readInt8': readInt8,
			'readVarInt': readVarInt,
			'readAll': readAll,
			'reset': reset,
			'pos': pos
	    }

	}else{
		return {
			'write': write,
			'writeInt32': writeInt32,
			'writeInt16': writeInt16,
			'writeInt8': writeInt8,
			'writeVarInt': writeVarInt,
			'readAll': readAll,
			'reset': reset,
			'pos': pos
		}

	}
}

if(typeof module!='undefined'){
	module.exports.Stream = Stream;
}
