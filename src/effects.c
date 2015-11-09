#include <pebble.h>
#include "effects.h"

#ifdef PBL_SDK_2
#define IF_23(sdk2, sdk3) (sdk2)
#else
#define IF_23(sdk2, sdk3) (sdk3)
#endif

// { ********* Graphics utility functions (probablu should be seaparated into anothe file?) *********

// set pixel color at given coordinates 
void set_pixel(uint8_t *bitmap_data, int bytes_per_row, int y, int x, uint8_t color) {
      
  #ifdef PBL_COLOR 
    bitmap_data[y*bytes_per_row + x] = color; // in Basalt - simple set entire byte
  #else
    bitmap_data[y*bytes_per_row + x / 8] ^= (-color ^ bitmap_data[y*bytes_per_row + x / 8]) & (1 << (x % 8)); // in Aplite - set the bit
  #endif
}

// get pixel color at given coordinates 
uint8_t get_pixel(uint8_t *bitmap_data, int bytes_per_row, int y, int x) {
  
  #ifdef PBL_COLOR
    return bitmap_data[y*bytes_per_row + x]; // in Basalt - simple get entire byte
  #else
    return (bitmap_data[y*bytes_per_row + x / 8] >> (x % 8)) & 1; // in Aplite - get the bit
  #endif
}
 

// THE EXTREMELY FAST LINE ALGORITHM Variation E (Addition Fixed Point PreCalc Small Display)
// Small Display (256x256) resolution.
// based on algorythm by Po-Han Lin at http://www.edepot.com
void set_line(uint8_t *bitmap_data, int bytes_per_row, int y, int x, int y2, int x2, uint8_t draw_color, uint8_t skip_color, uint8_t *visited) {
  bool yLonger = false;	int shortLen=y2-y; int longLen=x2-x;
  uint8_t temp_pixel;  int temp_x, temp_y;
  
	if (abs(shortLen)>abs(longLen)) {
		int swap=shortLen;
		shortLen=longLen;	longLen=swap;	yLonger=true;
	}
  
	int decInc;
	if (longLen==0) decInc=0;
	else decInc = (shortLen << 8) / longLen;

	if (yLonger) {
		if (longLen>0) {
			longLen+=y;
			for (int j=0x80+(x<<8);y<=longLen;++y) {
        temp_y = y; temp_x = j >> 8;
        if (temp_y >=0 && temp_y<168 && temp_x >=0 && temp_x < 144) {
          temp_pixel = get_pixel(bitmap_data, bytes_per_row,  temp_y, temp_x);
          #ifdef PBL_COLOR // for Basalt drawing pixel if it is not of original color or already drawn color
            if (temp_pixel != skip_color && temp_pixel != draw_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color);
          #else
            if (get_pixel(visited, bytes_per_row,  temp_y, temp_x) != 1) { // for Aplite first check if pixel isn't already marked as set in user-defined array
              if (temp_pixel != skip_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color); // if pixel isn't of original color - set it
              draw_color = 1 - draw_color; // revers pixel for "lined" effect
              set_pixel(visited, bytes_per_row, temp_y, temp_x, 1); //mark pixel as set
            }
          #endif
        }
				j+=decInc;
			}
			return;
		}
		longLen+=y;
		for (int j=0x80+(x<<8);y>=longLen;--y) {
      temp_y = y; temp_x = j >> 8;
      if (temp_y >=0 && temp_y<168 && temp_x >=0 && temp_x < 144) {
        temp_pixel = get_pixel(bitmap_data, bytes_per_row,  temp_y, temp_x);
          #ifdef PBL_COLOR // for Basalt drawing pixel if it is not of original color or already drawn color
            if (temp_pixel != skip_color && temp_pixel != draw_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color);
          #else
            if (get_pixel(visited, bytes_per_row,  temp_y, temp_x) != 1) { // for Aplite first check if pixel isn't already marked as set in user-defined array
              if (temp_pixel != skip_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color); // if pixel isn't of original color - set it
              draw_color = 1 - draw_color; // revers pixel for "lined" effect
              set_pixel(visited, bytes_per_row, temp_y, temp_x, 1); //mark pixel as set
            }
          #endif
      }
			j-=decInc;
		}
		return;	
	}

	if (longLen>0) {
		longLen+=x;
		for (int j=0x80+(y<<8);x<=longLen;++x) {
      temp_y = j >> 8; temp_x =  x;
      if (temp_y >=0 && temp_y<168 && temp_x >=0 && temp_x < 144) {
        temp_pixel = get_pixel(bitmap_data, bytes_per_row, temp_y, temp_x);
          #ifdef PBL_COLOR // for Basalt drawing pixel if it is not of original color or already drawn color
            if (temp_pixel != skip_color && temp_pixel != draw_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color);
          #else
            if (get_pixel(visited, bytes_per_row,  temp_y, temp_x) != 1) { // for Aplite first check if pixel isn't already marked as set in user-defined array
              if (temp_pixel != skip_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color); // if pixel isn't of original color - set it
              draw_color = 1 - draw_color; // revers pixel for "lined" effect
              set_pixel(visited, bytes_per_row, temp_y, temp_x, 1); //mark pixel as set
            }
          #endif
      }  
			j+=decInc;
		}
		return;
	}
	longLen+=x;
	for (int j=0x80+(y<<8);x>=longLen;--x) {
	  temp_y = j >> 8; temp_x =  x;
    if (temp_y >=0 && temp_y<168 && temp_x >=0 && temp_x < 144) {
      temp_pixel = get_pixel(bitmap_data, bytes_per_row, temp_y, temp_x);
          #ifdef PBL_COLOR // for Basalt drawing pixel if it is not of original color or already drawn color
            if (temp_pixel != skip_color && temp_pixel != draw_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color);
          #else
            if (get_pixel(visited, bytes_per_row,  temp_y, temp_x) != 1) { // for Aplite first check if pixel isn't already marked as set in user-defined array
              if (temp_pixel != skip_color) set_pixel(bitmap_data, bytes_per_row, temp_y, temp_x, draw_color); // if pixel isn't of original color - set it
              draw_color = 1 - draw_color; // revers pixel for "lined" effect
              set_pixel(visited, bytes_per_row, temp_y, temp_x, 1); //mark pixel as set
            }
          #endif
    }  
		j-=decInc;
	}

}

// Integer division with rounding
int32_t divide(int32_t n, int32_t d)
{
  return ((n < 0) ^ (d < 0)) ? ((n - d/2) / d) : ((n + d/2) / d);
}

// Makes sure the component value is a valid RGB value
uint8_t valid_rgb(int16_t val) {
  if (val < 0)
    return 0;
  else if (val > 255)
    return 255;
  else
    return val;
}

struct hsv_color {
  uint16_t hue;        /* Hue degree between 0 and 360 */
  uint8_t sat;        /* Saturation between 0 (gray) and 255 */
  uint8_t val;        /* Value between 0 (black) and 255 */
};

#ifdef PBL_COLOR
  
struct hsv_color rgb_to_hsv(GColor8 rgb) {
  struct hsv_color hsv;
  uint8_t rgb_min, rgb_max;
  rgb_min = (rgb.r < rgb.g && rgb.r < rgb.b) ? rgb.r : ((rgb.g < rgb.r && rgb.g < rgb.b) ? rgb.g : rgb.b);
  rgb_max = (rgb.r > rgb.g && rgb.r > rgb.b) ? rgb.r : ((rgb.g > rgb.r && rgb.g > rgb.b) ? rgb.g : rgb.b);
  hsv.val = rgb_max;
  if (hsv.val == 0) {
    hsv.hue = hsv.sat = 0;
    return hsv;
  }
  hsv.sat = 255*(int16_t)(rgb_max - rgb_min)/hsv.val;
  if (hsv.sat == 0) {
    hsv.hue = 0;
    return hsv;
  }
  /* Compute hue */
  if (rgb_max == rgb.r) {
    hsv.hue = 0 + 60*(rgb.g - rgb.b)/(rgb_max - rgb_min);
  } else if (rgb_max == rgb.g) {
    hsv.hue = 120 + 60*(rgb.b - rgb.r)/(rgb_max - rgb_min);
  } else /* rgb_max == rgb.b */ {
    hsv.hue = 240 + 60*(rgb.r - rgb.g)/(rgb_max - rgb_min);
  }
  return hsv;
}

#endif

//  ********* Graphics utility functions (probablu should be seaparated into anothe file?) ********* }

  

// inverter effect.
void effect_invert(GContext* ctx,  GRect position, void* param) {
  //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
  int bytes_per_row = gbitmap_get_bytes_per_row(fb);

  
  for (int y = 0; y < position.size.h; y++)
     for (int x = 0; x < position.size.w; x++)
        #ifdef PBL_COLOR // on Basalt simple doing NOT on entire returned byte/pixel
          set_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, ~get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x));
        #else // on Aplite since only 1 and 0 is returning, doing "not" by 1 - pixel
          set_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, 1 - get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x));
        #endif
 
  graphics_release_frame_buffer(ctx, fb);          
          
}


// invert black and white only (leaves all other colors intact).
void effect_invert_bw_only(GContext* ctx,  GRect position, void* param) {
  //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
#ifdef PBL_RECT
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
#endif
  int bytes_per_row = PBL_IF_RECT_ELSE(gbitmap_get_bytes_per_row(fb), 0);

#ifdef PBL_COLOR
  GColor pixel;
#endif
  
  for (int y = 0; y < position.size.h; y++) {
    // Get the min and max x values for this row
#ifndef PBL_SDK_2
    GBitmapDataRowInfo info = gbitmap_get_data_row_info(fb, y);
#endif
     for (int x = IF_23(0, info.min_x); x < IF_23(position.size.w, info.max_x+1); x++) {
        #ifdef PBL_COLOR // on Basalt invert only black or white
          pixel.argb = get_pixel(PBL_IF_RECT_ELSE(bitmap_data, info.data), bytes_per_row, y + position.origin.y, x + position.origin.x);
          if (gcolor_equal(pixel, GColorBlack))
            set_pixel(PBL_IF_RECT_ELSE(bitmap_data, info.data), bytes_per_row, y + position.origin.y, x + position.origin.x, GColorWhite.argb);
          else if (gcolor_equal(pixel, GColorWhite))
            set_pixel(PBL_IF_RECT_ELSE(bitmap_data, info.data), bytes_per_row, y + position.origin.y, x + position.origin.x, GColorBlack.argb);
        #else // on Aplite since only 1 and 0 is returning, doing "not" by 1 - pixel
          set_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, 1 - get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x));
        #endif
     }
  }
 
  graphics_release_frame_buffer(ctx, fb);          
          
}


// invert brightness of colors (leaves hue more or less intact and does not apply to black and white).
void effect_invert_brightness(GContext* ctx,  GRect position, void* param) {
#ifdef PBL_COLOR
  //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
#ifdef PBL_RECT
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
#endif
  int bytes_per_row = PBL_IF_RECT_ELSE(gbitmap_get_bytes_per_row(fb), 0);

  GColor pixel;
  GColor pixel_new;
  
  for (int y = 0; y < position.size.h; y++) {
#ifndef PBL_SDK_2
    GBitmapDataRowInfo info = gbitmap_get_data_row_info(fb, y);
#endif
     for (int x = IF_23(0, info.min_x); x < IF_23(position.size.w, info.max_x+1); x++) {
         pixel.argb = get_pixel(PBL_IF_RECT_ELSE(bitmap_data, info.data), bytes_per_row, y + position.origin.y, x + position.origin.x);
         
         if (!gcolor_equal(pixel, GColorBlack) && !gcolor_equal(pixel, GColorWhite)) {
           // Only apply if not black/white (add effect_invert_bw_only for that too)
           
           // Color spread is not even, so need to handcraft the opposing brightness of colors,
           // which is probably subjective and open for improvement
           if (gcolor_equal(pixel, GColorOxfordBlue))
             pixel_new = GColorCeleste;
           else if (gcolor_equal(pixel, GColorDukeBlue))
             pixel_new = GColorVividCerulean;
           else if (gcolor_equal(pixel, GColorBlue))
             pixel_new = GColorPictonBlue;
           else if (gcolor_equal(pixel, GColorDarkGreen))
             pixel_new = GColorMintGreen;
           else if (gcolor_equal(pixel, GColorMidnightGreen))
             pixel_new = GColorMediumSpringGreen;
           else if (gcolor_equal(pixel, GColorCobaltBlue))
             pixel_new = GColorCyan;
           else if (gcolor_equal(pixel, GColorBlueMoon))
             pixel_new = GColorElectricBlue;
           else if (gcolor_equal(pixel, GColorIslamicGreen))
             pixel_new = GColorMalachite;
           else if (gcolor_equal(pixel, GColorJaegerGreen))
             pixel_new = GColorScreaminGreen;
           else if (gcolor_equal(pixel, GColorTiffanyBlue))
             pixel_new = GColorCadetBlue;
           else if (gcolor_equal(pixel, GColorVividCerulean))
             pixel_new = GColorDukeBlue;
           else if (gcolor_equal(pixel, GColorGreen))
             pixel_new = GColorMayGreen;
           else if (gcolor_equal(pixel, GColorMalachite))
             pixel_new = GColorIslamicGreen;
           else if (gcolor_equal(pixel, GColorMediumSpringGreen))
             pixel_new = GColorMidnightGreen;
           else if (gcolor_equal(pixel, GColorCyan))
             pixel_new = GColorCobaltBlue;
           else if (gcolor_equal(pixel, GColorBulgarianRose))
             pixel_new = GColorMelon;
           else if (gcolor_equal(pixel, GColorImperialPurple))
             pixel_new = GColorRichBrilliantLavender;
           else if (gcolor_equal(pixel, GColorIndigo))
             pixel_new = GColorLavenderIndigo;
           else if (gcolor_equal(pixel, GColorElectricUltramarine))
             pixel_new = GColorVeryLightBlue;
           else if (gcolor_equal(pixel, GColorArmyGreen))
             pixel_new = GColorBrass;
           else if (gcolor_equal(pixel, GColorDarkGray))
             pixel_new = GColorLightGray;
           else if (gcolor_equal(pixel, GColorLiberty))
             pixel_new = GColorBabyBlueEyes;
           else if (gcolor_equal(pixel, GColorVeryLightBlue))
             pixel_new = GColorElectricUltramarine;
           else if (gcolor_equal(pixel, GColorKellyGreen))
             pixel_new = GColorGreen;
           else if (gcolor_equal(pixel, GColorMayGreen))
             pixel_new = GColorMediumAquamarine;
           else if (gcolor_equal(pixel, GColorCadetBlue))
             pixel_new = GColorTiffanyBlue;
           else if (gcolor_equal(pixel, GColorPictonBlue))
             pixel_new = GColorBlue;
           else if (gcolor_equal(pixel, GColorBrightGreen))
             pixel_new = GColorIslamicGreen;
           else if (gcolor_equal(pixel, GColorScreaminGreen))
             pixel_new = GColorKellyGreen;
           else if (gcolor_equal(pixel, GColorMediumAquamarine))
             pixel_new = GColorMayGreen;
           else if (gcolor_equal(pixel, GColorElectricBlue))
             pixel_new = GColorBlueMoon;
           else if (gcolor_equal(pixel, GColorDarkCandyAppleRed))
             pixel_new = GColorMelon;
           else if (gcolor_equal(pixel, GColorJazzberryJam))
             pixel_new = GColorBrilliantRose;
           else if (gcolor_equal(pixel, GColorPurple))
             pixel_new = GColorShockingPink;
           else if (gcolor_equal(pixel, GColorVividViolet))
             pixel_new = GColorPurpureus;
           else if (gcolor_equal(pixel, GColorWindsorTan))
             pixel_new = GColorRoseVale;
           else if (gcolor_equal(pixel, GColorRoseVale))
             pixel_new = GColorWindsorTan;
           else if (gcolor_equal(pixel, GColorPurpureus))
             pixel_new = GColorVividViolet;
           else if (gcolor_equal(pixel, GColorLavenderIndigo))
             pixel_new = GColorIndigo;
           else if (gcolor_equal(pixel, GColorLimerick))
             pixel_new = GColorPastelYellow;
           else if (gcolor_equal(pixel, GColorBrass))
             pixel_new = GColorArmyGreen;
           else if (gcolor_equal(pixel, GColorLightGray))
             pixel_new = GColorDarkGray;
           else if (gcolor_equal(pixel, GColorBabyBlueEyes))
             pixel_new = GColorLiberty;
           else if (gcolor_equal(pixel, GColorSpringBud))
             pixel_new = GColorDarkGreen;
           else if (gcolor_equal(pixel, GColorInchworm))
             pixel_new = GColorMidnightGreen;
           else if (gcolor_equal(pixel, GColorMintGreen))
             pixel_new = GColorDarkGreen;
           else if (gcolor_equal(pixel, GColorCeleste))
             pixel_new = GColorOxfordBlue;
           else if (gcolor_equal(pixel, GColorRed))
             pixel_new = GColorSunsetOrange;
           else if (gcolor_equal(pixel, GColorFolly))
             pixel_new = GColorMelon;
           else if (gcolor_equal(pixel, GColorFashionMagenta))
             pixel_new = GColorMagenta ;
           else if (gcolor_equal(pixel, GColorMagenta))
             pixel_new = GColorFashionMagenta;
           else if (gcolor_equal(pixel, GColorOrange))
             pixel_new = GColorRajah;
           else if (gcolor_equal(pixel, GColorSunsetOrange))
             pixel_new = GColorRed;
           else if (gcolor_equal(pixel, GColorBrilliantRose))
             pixel_new = GColorJazzberryJam;
           else if (gcolor_equal(pixel, GColorShockingPink))
             pixel_new = GColorPurple;
           else if (gcolor_equal(pixel, GColorChromeYellow))
             pixel_new = GColorWindsorTan;
           else if (gcolor_equal(pixel, GColorRajah))
             pixel_new = GColorOrange;
           else if (gcolor_equal(pixel, GColorMelon))
             pixel_new = GColorDarkCandyAppleRed;
           else if (gcolor_equal(pixel, GColorRichBrilliantLavender))
             pixel_new = GColorImperialPurple;
           else if (gcolor_equal(pixel, GColorYellow))
             pixel_new = GColorChromeYellow;
           else if (gcolor_equal(pixel, GColorIcterine))
             pixel_new = GColorChromeYellow;
           else if (gcolor_equal(pixel, GColorPastelYellow))
             pixel_new = GColorChromeYellow;
           
           set_pixel(PBL_IF_RECT_ELSE(bitmap_data, info.data), bytes_per_row, y + position.origin.y, x + position.origin.x, pixel_new.argb);
         }
     }
  }
 
  graphics_release_frame_buffer(ctx, fb);          
          
#endif
}

// vertical mirror effect.
void effect_mirror_vertical(GContext* ctx, GRect position, void* param) {
  uint8_t temp_pixel;  
  
  //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
  int bytes_per_row = gbitmap_get_bytes_per_row(fb);

  for (int y = 0; y < position.size.h / 2 ; y++)
     for (int x = 0; x < position.size.w; x++){
        temp_pixel = get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x);
        set_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, get_pixel(bitmap_data, bytes_per_row, position.origin.y + position.size.h - y - 2, x + position.origin.x));
        set_pixel(bitmap_data, bytes_per_row, position.origin.y + position.size.h - y - 2, x + position.origin.x, temp_pixel);
     }
  
  graphics_release_frame_buffer(ctx, fb);
}


// horizontal mirror effect.
void effect_mirror_horizontal(GContext* ctx, GRect position, void* param) {
  uint8_t temp_pixel;  
  
  //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
  int bytes_per_row = gbitmap_get_bytes_per_row(fb);


  for (int y = 0; y < position.size.h; y++)
     for (int x = 0; x < position.size.w / 2; x++){
        temp_pixel = get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x);
        set_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, position.origin.x + position.size.w - x - 2));
        set_pixel(bitmap_data, bytes_per_row, y + position.origin.y, position.origin.x + position.size.w - x - 2, temp_pixel);
     }
  
  graphics_release_frame_buffer(ctx, fb);
}

// Rotate 90 degrees
// Added by Ron64
// Parameter:  true: rotate right/clockwise,  false: rotate left/counter_clockwise
void effect_rotate_90_degrees(GContext* ctx,  GRect position, void* param){

  //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
  int bytes_per_row = gbitmap_get_bytes_per_row(fb);

  bool right = (bool)param;
  uint8_t qtr, xCn, yCn, temp_pixel;
  xCn= position.origin.x + position.size.w /2;
  yCn= position.origin.y + position.size.h /2;
  qtr=position.size.w;
  if (position.size.h < qtr)
    qtr= position.size.h;
  qtr= qtr/2;

  for (int c1 = 0; c1 < qtr; c1++)
    for (int c2 = 1; c2 < qtr; c2++){
      temp_pixel = get_pixel(bitmap_data, bytes_per_row, yCn +c1, xCn +c2);
      if (right){
        set_pixel(bitmap_data, bytes_per_row, yCn +c1, xCn +c2, get_pixel(bitmap_data, bytes_per_row, yCn -c2, xCn +c1));
        set_pixel(bitmap_data, bytes_per_row, yCn -c2, xCn +c1, get_pixel(bitmap_data, bytes_per_row, yCn -c1, xCn -c2));
        set_pixel(bitmap_data, bytes_per_row, yCn -c1, xCn -c2, get_pixel(bitmap_data, bytes_per_row, yCn +c2, xCn -c1));
        set_pixel(bitmap_data, bytes_per_row, yCn +c2, xCn -c1, temp_pixel);
      }
      else{
        set_pixel(bitmap_data, bytes_per_row, yCn +c1, xCn +c2, get_pixel(bitmap_data, bytes_per_row, yCn +c2, xCn -c1));
        set_pixel(bitmap_data, bytes_per_row, yCn +c2, xCn -c1, get_pixel(bitmap_data, bytes_per_row, yCn -c1, xCn -c2));
        set_pixel(bitmap_data, bytes_per_row, yCn -c1, xCn -c2, get_pixel(bitmap_data, bytes_per_row, yCn -c2, xCn +c1));
        set_pixel(bitmap_data, bytes_per_row, yCn -c2, xCn +c1, temp_pixel);
      }
     }
  
  graphics_release_frame_buffer(ctx, fb);
}

// Zoom effect.
// Added by Ron64
// Parameter: Y zoom (high byte) X zoom(low byte),  0x10 no zoom 0x20 200% 0x08 50%, 
// use the percentage macro EL_ZOOM(150,60). In this example: Y- zoom in 150%, X- zoom out to 60% 
void effect_zoom(GContext* ctx,  GRect position, void* param){
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bd =  gbitmap_get_data(fb);
  int bpr = gbitmap_get_bytes_per_row(fb);

  uint8_t xCn, yCn, Y1,X1, ratioY, ratioX;
  xCn= position.origin.x + position.size.w /2;
  yCn= position.origin.y + position.size.h /2;

  ratioY= (int32_t)param >>8 & 0xFF;
  ratioX= (int32_t)param & 0xFF;

  for (int y = 0; y <= position.size.h>>1; y++)
    for (int x = 0; x <= position.size.w>>1; x++)
    {
      //yS,xS scan source: centre to out or out to centre
      int8_t yS = (ratioY>16) ? (position.size.h/2)- y: y; 
      int8_t xS = (ratioX>16) ? (position.size.w/2)- x: x;
      Y1= (yS<<4) /ratioY;
      X1= (xS<<4) /ratioX;
      set_pixel(bd,bpr, yCn +yS, xCn +xS, get_pixel(bd,bpr, yCn +Y1, xCn +X1)); 
      set_pixel(bd,bpr, yCn +yS, xCn -xS, get_pixel(bd,bpr, yCn +Y1, xCn -X1));
      set_pixel(bd,bpr, yCn -yS, xCn +xS, get_pixel(bd,bpr, yCn -Y1, xCn +X1));
      set_pixel(bd,bpr, yCn -yS, xCn -xS, get_pixel(bd,bpr, yCn -Y1, xCn -X1));
    }
  graphics_release_frame_buffer(ctx, fb);
//Todo: Should probably reduce Y size on zoom out or limit reading beyond edge of screen.
}
  
// mask effect.
// see struct EffectMask for parameter description  
void effect_mask(GContext* ctx, GRect position, void* param) {
  GColor temp_pixel;  
  EffectMask *mask = (EffectMask *)param;

  //drawing background - only if real color is passed
  if (!gcolor_equal(mask->background_color, GColorClear)) {
    graphics_context_set_fill_color(ctx, mask->background_color);
    graphics_fill_rect(ctx, GRect(0, 0, position.size.w, position.size.h), 0, GCornerNone); 
  }  
  
  //if text mask is used - drawing text
  if (mask->text) {
     graphics_context_set_text_color(ctx, mask->mask_color);
     graphics_draw_text(ctx, mask->text, mask->font, GRect(0, 0, position.size.w, position.size.h), mask->text_overflow, mask->text_align, NULL);
  } else if (mask->bitmap_mask) { // othersise - bitmap mask is used - draw bimap
     graphics_draw_bitmap_in_rect(ctx, mask->bitmap_mask, GRect(0, 0, position.size.w, position.size.h));
  }
    
  //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
  int bytes_per_row = gbitmap_get_bytes_per_row(fb);
  
  //capturing background bitmap
  uint8_t *bg_bitmap_data =  gbitmap_get_data(mask->bitmap_background);
  int bg_bytes_per_row = gbitmap_get_bytes_per_row(mask->bitmap_background);
    
  //looping throughout layer replacing mask with bg bitmap
  for (int y = 0; y < position.size.h; y++)
     for (int x = 0; x < position.size.w; x++) {
       temp_pixel = (GColor)get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x);
       if (gcolor_equal(temp_pixel, mask->mask_color))
         set_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, get_pixel(bg_bitmap_data, bg_bytes_per_row, y + position.origin.y, x + position.origin.x));
  }
  
  graphics_release_frame_buffer(ctx, fb);
  
}

void effect_fps(GContext* ctx, GRect position, void* param) {
  static GFont font = NULL;
  static char buff[16];
  time_t tt;
  uint16_t ms;
  
  if(((EffectFPS*)param)->starttt) {
    time_ms(&tt,&ms);
    ++((EffectFPS*)param)->frame;
    uint32_t fp100s = (100000*((EffectFPS*)param)->frame)/((tt-((EffectFPS*)param)->starttt)*1000+ms-((EffectFPS*)param)->startms);
    snprintf(buff,sizeof(buff),"FPS:%d.%02d",(int)fp100s/100,(int)fp100s%100);
    graphics_context_set_stroke_color(ctx, GColorWhite);
    graphics_draw_text(ctx, buff, font, GRect(0, 0, position.size.w, position.size.h), GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);
  }
  else {
    // First call
    if(!font) font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
    time_ms(&((EffectFPS*)param)->starttt,&((EffectFPS*)param)->startms);
    ((EffectFPS*)param)->frame = 0;
  }
}


// mask effect.
// see struct EffecOffset for parameter description  
void effect_shadow(GContext* ctx, GRect position, void* param) {
  GColor temp_pixel;  
  int shadow_x, shadow_y;
  EffectOffset *shadow = (EffectOffset *)param;
  
  #ifndef PBL_COLOR
    uint8_t draw_color = gcolor_equal(shadow->offset_color, GColorWhite)? 1 : 0;
    uint8_t skip_color = gcolor_equal(shadow->orig_color, GColorWhite)? 1 : 0;
  #endif
  
   //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
  int bytes_per_row = gbitmap_get_bytes_per_row(fb);

  
  //looping throughout making shadow
  for (int y = 0; y < position.size.h; y++)
     for (int x = 0; x < position.size.w; x++) {
       temp_pixel = (GColor)get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x);
       
       if (gcolor_equal(temp_pixel, shadow->orig_color)) {
         shadow_x =  x + position.origin.x + shadow->offset_x;
         shadow_y =  y + position.origin.y + shadow->offset_y;
         
         if (shadow->option == 1) {
            #ifdef PBL_COLOR // for Basalt simple calling line-drawing routine
               set_line(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, shadow_y, shadow_x, shadow->offset_color.argb, shadow->orig_color.argb, NULL);
            #else // for Aplite - passing user-defined array to determine if pixels have been set or not
               set_line(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x, shadow_y, shadow_x, draw_color, skip_color, shadow->aplite_visited); 
            #endif
           
         } else {
           
             if (shadow_x >= 0 && shadow_x <=143 && shadow_y >= 0 && shadow_y <= 167) {
             
               temp_pixel = (GColor)get_pixel(bitmap_data, bytes_per_row, shadow_y, shadow_x);
               if (!gcolor_equal(temp_pixel, shadow->orig_color) & !gcolor_equal(temp_pixel, shadow->offset_color) ) {
                 #ifdef PBL_COLOR
                    set_pixel(bitmap_data, bytes_per_row,  shadow_y, shadow_x, shadow->offset_color.argb);  
                 #else
                    set_pixel(bitmap_data, bytes_per_row,  shadow_y, shadow_x, gcolor_equal(shadow->offset_color, GColorWhite)? 1 : 0);
                 #endif
               }
             }
           
         }
         
         
       }
  }
         
  graphics_release_frame_buffer(ctx, fb);
 
}

void effect_outline(GContext* ctx, GRect position, void* param) {
  GColor temp_pixel;  
  int outlinex[4];
  int outliney[4];
  EffectOffset *outline = (EffectOffset *)param;
  
   //capturing framebuffer bitmap
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  uint8_t *bitmap_data =  gbitmap_get_data(fb);
  int bytes_per_row = gbitmap_get_bytes_per_row(fb);
  
  //loop through pixels from framebuffer
  for (int y = 0; y < position.size.h; y++)
     for (int x = 0; x < position.size.w; x++) {
       temp_pixel = (GColor)get_pixel(bitmap_data, bytes_per_row, y + position.origin.y, x + position.origin.x);
       
       if (gcolor_equal(temp_pixel, outline->orig_color)) {
          // TODO: there's probably a more efficient way to do this
          outlinex[0] = x + position.origin.x - outline->offset_x;
          outliney[0] = y + position.origin.y - outline->offset_y;
          outlinex[1] = x + position.origin.x + outline->offset_x;
          outliney[1] = y + position.origin.y + outline->offset_y;
          outlinex[2] = x + position.origin.x - outline->offset_x;
          outliney[2] = y + position.origin.y + outline->offset_y;
          outlinex[3] = x + position.origin.x + outline->offset_x;
          outliney[3] = y + position.origin.y - outline->offset_y;
          
         
          for (int i = 0; i < 4; i++) {
            // TODO: centralize the constants
            if (outlinex[i] >= 0 && outlinex[i] <=144 && outliney[i] >= 0 && outliney[i] <= 168) {
              temp_pixel = (GColor)get_pixel(bitmap_data, bytes_per_row, outliney[i], outlinex[i]);
              if (!gcolor_equal(temp_pixel, outline->orig_color)) {
                #ifdef PBL_COLOR
                   set_pixel(bitmap_data, bytes_per_row, outliney[i], outlinex[i], outline->offset_color.argb);  
                #else
                   set_pixel(bitmap_data, bytes_per_row, outliney[i], outlinex[i], gcolor_equal(outline->offset_color, GColorWhite)? 1 : 0);
                #endif
              }
            }
          }
       }
  }

  graphics_release_frame_buffer(ctx, fb);
}