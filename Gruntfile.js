
module.exports = function(grunt){
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            dist:{
                files: {
                    'build/midijs_plus-<%= pkg.version  %>.js': 
                        'Base64,Base64binary,WebAudioAPI'.split(',').map(function(e){
                                return 'shim/' + e + '.js';
                        }).concat('stream,midifile,midiwriter,replayer,audioDetect,gm,plugin,loader,player'.split(',').map(function(e){
                            return 'src/' + e + '.js';
                        })

                    )
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-coffee');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask('default', ['uglify:dist']);
}