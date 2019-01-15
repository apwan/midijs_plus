
module.exports = function(grunt){
    grunt.initConfig({
        uglify: {
            dist:{
                files: {
                    'build/midijs_plus.js': 'stream,midifile,replayer,audioDetect,gm,plugin,loader,player'.split(',').map(function(e){
                        return 'src/' + e + '.js';
                    })
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask('default', ['uglify:dist']);
}