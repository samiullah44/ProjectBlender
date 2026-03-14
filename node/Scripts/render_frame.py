
import bpy
import sys
import os
import json
import time

print('=== BlendFarm Render Script Started ===')

# Find config file from arguments
config_file = None
for i, arg in enumerate(sys.argv):
    if arg == '--' and i + 1 < len(sys.argv):
        config_file = sys.argv[i + 1]
        break

if not config_file or not os.path.exists(config_file):
    print('ERROR: No valid config file provided')
    print(f'Arguments: {sys.argv}')
    sys.exit(1)

print(f'Config file: {config_file}')

# Read config
with open(config_file, 'r') as f:
    config_data = json.load(f)

if isinstance(config_data, list) and len(config_data) > 0:
    config = config_data[0]
else:
    config = config_data

frame_num = config.get('frame', 1)
output_path = config.get('output', '//output.png')
samples = config.get('samples', 30)
engine = config.get('engine', 'CYCLES').upper()
device_type = config.get('device', 'GPU').upper()
resolution_x = config.get('resolution_x', 1920)
resolution_y = config.get('resolution_y', 1080)
output_format = config.get('output_format', 'PNG').upper()
color_mode = config.get('color_mode', 'RGBA').upper()
color_depth = config.get('color_depth', '8').upper()
raw_compression = config.get('compression', 90)

# Normalize compression/quality:
# - Preserve 0 as a valid value (meaning: lowest compression for PNG, lowest quality for JPEG)
# - Treat missing/empty as default
# - Clamp to [0, 100]
try:
    if raw_compression is None or raw_compression == '':
        compression = 90
    else:
        compression = int(raw_compression)
except Exception:
    compression = 90
compression = max(0, min(100, compression))
exr_codec = config.get('exr_codec', 'ZIP').upper()
tiff_codec = config.get('tiff_codec', 'DEFLATE').upper()
scene_name = config.get('scene', '')
camera_name = config.get('camera', '')
denoiser = config.get('denoiser', 'NONE').upper()
tile_size = config.get('tile_size', 256)
use_animation_settings = config.get('use_animation_settings', False)

print(f'=== Render Settings ===')
print(f'  Frame: {frame_num}')
print(f'  Output: {output_path}')
print(f'  Samples: {samples}')
print(f'  Engine: {engine}')
print(f'  Device: {device_type}')
print(f'  Resolution: {resolution_x}x{resolution_y}')
print(f'  Format: {output_format}')
print(f'  Color: {color_mode} {color_depth}-bit')
print(f'  Compression/Quality: {compression}')
print(f'  Scene: {scene_name if scene_name else "Default"}')
print(f'  Camera: {camera_name if camera_name else "Default"}')
print(f'  Denoiser: {denoiser}')
print(f'  Tile Size: {tile_size}')
print(f'  Animation Mode: {use_animation_settings}')

# Apply ALL settings
scene = bpy.context.scene

# Set explicit scene if requested
if scene_name and scene_name in bpy.data.scenes:
    scene = bpy.data.scenes[scene_name]
    bpy.context.window.scene = scene
    print(f'Switched to scene: {scene_name}')

# Set explicit camera if requested
if camera_name and camera_name in bpy.data.objects:
    cam_obj = bpy.data.objects[camera_name]
    if cam_obj.type == 'CAMERA':
        scene.camera = cam_obj
        print(f'Set active camera: {camera_name}')
scene.frame_set(frame_num)

# Set engine and device - FIXED: No conflicting overrides
if engine == 'CYCLES':
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    
    # Set denoising based on config
    if denoiser != 'NONE':
        try:
            scene.cycles.use_denoising = True
            if denoiser == 'OPENIMAGEDENOISE':
                scene.cycles.denoiser = 'OPENIMAGEDENOISE'
            elif denoiser == 'OPTIX':
                scene.cycles.denoiser = 'OPTIX'
            else:
                scene.cycles.denoiser = 'NLM'
            print(f'Enabled denoising with {denoiser}')
        except Exception as e:
            try:
                scene.cycles.use_denoising = True
                print('Enabled denoising (fallback)')
            except:
                print('Could not enable denoising')
    else:
        scene.cycles.use_denoising = False
        print('Denoising disabled')
    
    # FIXED: Use device from config. Check if it starts with GPU.
    if device_type.startswith('GPU'):
        try:
            # Try to enable GPU devices
            import addon_utils
            addon_utils.enable('cycles')
            
            # Set compute device type based on availability and request
            if hasattr(bpy.context.preferences.addons['cycles'], 'preferences'):
                prefs = bpy.context.preferences.addons['cycles'].preferences
                
                # Check available types: CUDA, OPTIX, HIP, METAL, ONEAPI
                # Order: User preference first, then fallback to best available
                requested = device_type
                if requested == 'GPU': requested = 'OPTIX' # Default to Optix for generic GPU
                
                priorities = [requested, 'OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI']
                
                success = False
                for compute_device_type in priorities:
                    try:
                        prefs.compute_device_type = compute_device_type
                        print(f'Attempting compute device type: {compute_device_type}')
                        # Refresh and check if any devices of this type exist
                        prefs.get_devices()
                        valid_devices = [d for d in prefs.devices if d.type == compute_device_type]
                        if valid_devices:
                            for device in valid_devices:
                                device.use = True
                                print(f'Enabled {compute_device_type} device: {device.name}')
                            success = True
                            break
                    except:
                        continue
                
                if not success:
                    print('Warning: No suitable GPU compute device found, using fallback if possible')
            
            scene.cycles.device = 'GPU'
            print('GPU rendering enabled')
        except Exception as e:
            print(f'Failed to initialize GPU: {e}')
            print('Falling back to CPU rendering')
            scene.cycles.device = 'CPU'
    else:
        scene.cycles.device = 'CPU'
        print('CPU rendering enabled as configured')
        
elif engine == 'EEVEE':
    import sys
    if bpy.app.version < (2, 80, 0):
        print(f"ERROR: EEVEE engine requires Blender 2.80 or newer. This node is running Blender {bpy.app.version[0]}.{bpy.app.version[1]}.{bpy.app.version[2]}")
        sys.exit(1)
        
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
        
    try:
        if hasattr(scene.eevee, 'taa_render_samples'):
            scene.eevee.taa_render_samples = samples
        elif hasattr(scene.eevee, 'taa_samples'):
            scene.eevee.taa_samples = samples
    except Exception as e:
        print(f"Warning: Could not set EEVEE samples: {e}")
        
    print(f'Eevee engine with {samples} samples')

# Set resolution
scene.render.resolution_x = resolution_x
scene.render.resolution_y = resolution_y
scene.render.resolution_percentage = 100

# Set tile size
try:
    if hasattr(scene.render, 'tile_x'):
        scene.render.tile_x = tile_size
        scene.render.tile_y = tile_size
    elif hasattr(scene.cycles, 'tile_size'):
        scene.cycles.tile_size = tile_size
    print(f'Tile size set to {tile_size}')
except:
    print('Could not set tile size (using default)')

# Set animation settings if needed
if use_animation_settings:
    # Ensure we're not using animation frames for single frame renders
    scene.frame_start = frame_num
    scene.frame_end = frame_num
    scene.frame_current = frame_num
    print(f'Animation settings: Frame range {frame_num}-{frame_num}')

# FIX CAMERA ISSUE: Ensure there is an active camera
if not scene.camera:
    print('WARNING: No active camera found in scene.')
    camera_found = False
    
    # First, try to find any existing camera in the scene
    for obj in scene.objects:
        if obj.type == 'CAMERA':
            scene.camera = obj
            print(f'Assigned existing camera: {obj.name}')
            camera_found = True
            break
            
    # If no camera exists, create a default one
    if not camera_found:
        print('Creating a default fallback camera.')
        cam_data = bpy.data.cameras.new('DefaultCamera')
        cam_obj = bpy.data.objects.new('DefaultCamera', cam_data)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj
        
        # Position it reasonably (e.g., looking at origin)
        cam_obj.location = (7.358, -6.925, 4.958)
        
        import math
        cam_obj.rotation_euler = (math.radians(63.2), math.radians(0), math.radians(46.7))

# Set output path
if output_path.startswith('//'):
    output_path = os.path.join(os.path.dirname(bpy.data.filepath), output_path[2:])
output_path = os.path.abspath(output_path)

# Ensure directory exists
output_dir = os.path.dirname(output_path)
if not os.path.exists(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    print(f'Created directory: {output_dir}')

# Set render output and format
scene.render.filepath = output_path

# Set output format based on configuration
format_settings = scene.render.image_settings
format_settings.color_mode = color_mode
format_settings.color_depth = color_depth

if output_format == 'PNG':
    format_settings.file_format = 'PNG'
    format_settings.compression = compression
elif output_format == 'JPEG' or output_format == 'JPG':
    format_settings.file_format = 'JPEG'
    format_settings.quality = compression
elif output_format == 'OPEN_EXR' or output_format == 'EXR':
    format_settings.file_format = 'OPEN_EXR'
    format_settings.exr_codec = exr_codec
elif output_format == 'TIFF':
    format_settings.file_format = 'TIFF'
    format_settings.tiff_codec = tiff_codec
elif output_format == 'TARGA' or output_format == 'TGA':
    format_settings.file_format = 'TARGA'
elif output_format == 'BMP':
    format_settings.file_format = 'BMP'
else:
    format_settings.file_format = 'PNG'
    print(f'Warning: Unknown format {output_format}, defaulting to PNG')

print(f'Output format set to: {format_settings.file_format}')

print('=== Starting Render ===')

try:
    start_time = time.time()
    
    # Determine if we need to render animation or single frame
    if use_animation_settings and frame_num != scene.frame_current:
        # For true animation rendering across frames
        print(f'Rendering animation frames {scene.frame_start}-{scene.frame_end}')
        scene.frame_set(frame_num)
        
        bpy.context.view_layer.update()
        bpy.context.evaluated_depsgraph_get().update()
        for obj in scene.objects:
            obj.hide_render = False
            
        bpy.ops.render.render(write_still=True, animation=False)
    else:
        # Single frame render
        print(f'Rendering single frame {frame_num}')
        scene.frame_set(frame_num)
        
        bpy.context.view_layer.update()
        bpy.context.evaluated_depsgraph_get().update()
        for obj in scene.objects:
            obj.hide_render = False
            
        bpy.ops.render.render(write_still=True, animation=False)
    
    end_time = time.time()
    
    print(f'=== Render Completed ===')
    print(f'Render time: {end_time - start_time:.2f} seconds')
    
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        print(f'SUCCESS: File saved successfully')
        print(f'File size: {file_size} bytes ({file_size/1024:.1f} KB)')
        print(f'Location: {output_path}')
        sys.exit(0)
    else:
        print(f'ERROR: File not found at: {output_path}')
        # Check what files were actually created
        if os.path.exists(output_dir):
            created_files = os.listdir(output_dir)
            print(f'Files in output directory: {created_files}')
            
            # Try to find any recently created image files
            for filename in created_files:
                if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.exr', '.tiff', '.tif')):
                    print(f'Found potential output file: {filename}')
                    # Check if it contains our frame number
                    if str(frame_num) in filename:
                        found_path = os.path.join(output_dir, filename)
                        print(f'Found matching file: {found_path}')
                        # Copy to expected location
                        os.rename(found_path, output_path)
                        print(f'Moved to expected location: {output_path}')
                        if os.path.exists(output_path):
                            sys.exit(0)
        
        sys.exit(1)
        
except Exception as e:
    print(f'ERROR during render: {str(e)}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
