// Approximate structure for the photo-thumbs page:
//
// <body>
//   (refresh button)
//   <div body-wrapper>
//      <div thumblist>
//        <ul>
//           <li>...   -- has without-photo class if accepting new photos
//        </ul>
//      </div>
//
//      <div photothumbs>
//         <div thumbnail>
//            <a>
//               <img unassigned-photo />
//            </a>...
//         </div>
//      </div>
//   </div>
// </body>

// draggable and droppable elements with scope: "assign" are for
// dragging unassigned photos to racers who are still without a photo.
//
// scope: "undo" is for removing a photo assignment, by dragging from
// the list element back to the photothumbs div.

// When a list item loses its photo, make it assignable again, i.e.,
// able to receive new photo assignments.
// target is a jquery for the list item(s).
function make_assignable(target) {
  target.droppable({
	scope: "assign",
	hoverClass: "droppableHover",
	drop: function(event, ui) {
	  var photo_base_name = ui.draggable.attr("data-image-filename");
	  var racer_id = $(this).attr("data-racer-id");

	  changeRacerPhotoAjax(racer_id, photo_base_name);

	  ui.draggable.closest(".thumbnail").addClass("hidden");
	  $(this).prepend('<img class="assigned"' +
					  ' data-image-filename="' + photo_base_name + '"' +
                      ' onclick="window.location.href=\'photo-crop.php?repo=' + g_photo_repo_name 
                      + '&name=' + encodeURIComponent(photo_base_name) + '\'"' +
					  ' src="photo.php/' + g_photo_repo_name + '/file/tiny/' +
					  encodeURIComponent(photo_base_name) + '/' +
                      'q' + Date.now() + '"/>'); 
	  make_discardable($(this).find(".assigned"));
	  // Once dropped, make no longer droppable!
	  $(this).droppable("destroy");
	}
  });
}

// Apply to img's when they are bound to a racer, changing them to 'undo' scope
// draggables.
function make_discardable(target) {
  target.draggable({
	revert: 'invalid',
	scope: 'undo',

	helper: 'clone',
	appendTo: 'body',
	opacity: 0.5,
  });
}

// target is a jquery for photo img's; allows them to be dragged to list items.
function make_draggable_photo(target) {
  target.draggable({
	helper: 'clone',
	appendTo: 'body',
	// When using helper: clone, the clone's top left corner
	// appears to be what controls selection of the droppable
	// target, and I don't see any way to change it to use the
	// mouse cursor instead.  If you can't beat 'em, join 'em:
	// use cursorAt to force the clone's top to match the
	// cursor.  (For picking from the list of racers, we don't
	// care so much about horizontal position.)

	// TODO: Don't know why only top has effect here.
	cursorAt: { top: 0, left: 20 },
	opacity: 0.5,
	revert: 'invalid',
	scope: "assign",
  });
}

$(function() {
  make_assignable($(".without-photo"));
  make_draggable_photo($(".unassigned_photo"));

  $(".photothumbs").droppable({
	hoverClass: 'droppableHover',
	scope: 'undo',
	drop: function(event, ui) {
	  // ui.draggable will be the assigned <img> itself
	  var image_filename = ui.draggable.attr("data-image-filename");

	  var list_item = ui.draggable.closest("li");
	  list_item.addClass("without-photo");
	  make_assignable(list_item);

	  ui.draggable.remove();
	  var hidden_thumbnail = $("img[data-image-filename='" + image_filename + "']").closest(".thumbnail");
	  hidden_thumbnail.removeClass("hidden");
	  // A previous drag may have added a style property with
	  // top and left values that will leave the image out of
	  // place; we need to clear them.
	  hidden_thumbnail.find("img")
		.css("top", "")
		.css("left", "");
	  removeRacerPhoto(list_item.attr("data-racer-id"));
	}
  });

  make_discardable($(".assigned"));
});


function changeRacerPhotoAjax(racer, photo) {
  $.ajax(g_action_url,
         {type: 'POST',
          data: {action: 'photo.assign',
                 repo: g_photo_repo_name,
                 racer: racer,
                 photo: photo}});
}

function removeRacerPhoto(previous) {
  changeRacerPhotoAjax(previous, '');
}


function setupPhotoCrop(repo_name, basename, time) {
  $("#work_image").html('<img src="photo.php/' + repo_name + '/file/work/' + basename + '/' + time + '"/>');

  // TODO: Figure out how to center the image

  g_crop = null;

  $('#work_image img').Jcrop({
	aspectRatio: g_aspect_ratio,
	onSelect: updateCrop,
	onChange: updateCrop
  });
}

function showPhotoCropModal(img, repo_name, basename, time) {
  setupPhotoCrop(repo_name, basename, time);
  $("#work_image").data('photo', {repo: repo_name,
                                  basename: basename,
                                  source: $(img)});

  show_modal('#photo_crop_modal');
}

var g_crop;
function updateCrop(c) {
  g_crop = c;
}

// Updates the url for an <img/> element to include a new cache-breaker
// timestamp, which effectively causes the image to be reloaded from the server.
//
// img is a jquery of the <img/> element.
// breaker_time is the new cache-breaker timestamp to use.
function updateImage(img, breaker_time) {
  var src = img.attr('src');
  img.attr('src', src.substr(0, src.lastIndexOf('/') + 1) + breaker_time);
}

function cropPhoto() {
  // g_crop may be null if no cropping has happened
  if (g_crop) {
    var photo_data = $("#work_image").data('photo');
    $.ajax(g_action_url,
           {type: 'POST',
            data: {action: 'photo.crop',
                   repo: photo_data.repo,
                   image_name: photo_data.basename,
                   left: g_crop.x,
                   top: g_crop.y,
                   right: g_crop.x2,
                   bottom: g_crop.y2,
                   original_height: $('#work_image img').height(),
                   original_width: $('#work_image img').width()
                  },
            success: function(data) {
              var breaker = data.getElementsByTagName('cache_breaker');
              if (breaker) {
                updateImage(photo_data.source, breaker[0].getAttribute('time'));
              }
            }
           });
  }
  close_modal('#photo_crop_modal');
}

function rotatePhoto(angle) {
  var photo_data = $("#work_image").data('photo');
  $.ajax(g_action_url,
         {type: 'POST',
          data: {action: 'photo.rotate',
                 repo: photo_data.repo,
                 image_name: photo_data.basename,
                 rotation: angle},
          success: function(data) {
            var breaker = data.getElementsByTagName('cache_breaker');
            if (breaker) {
              var breaker_time = breaker[0].getAttribute('time');
              setupPhotoCrop(photo_data.repo, photo_data.basename, breaker_time);
              updateImage(photo_data.source, breaker_time);
            }
          }
         });
}



Dropzone.options.uploadTarget = {
  paramName: 'photo',
  maxFilesize: 8,
  acceptedFiles: 'image/*',
  // dropzone considers the upload successful as long as there was an HTTP response.  We need to look at the
  // message that came back and determine whether the file was actually accepted.
  success: function(file, response) {
    var xml = $.parseXML(response);
    var failures = xml.getElementsByTagName("failure");
    if (failures.length > 0) {
      file.status = 'error';
      file.previewElement.querySelectorAll("[data-dz-errormessage]")[0].textContent = failures[0].textContent;
      file.previewElement.classList.add("dz-error");
    } else {
      var uploaded = xml.getElementsByTagName("uploaded");
      var thumb = xml.getElementsByTagName("thumbnail");
      if (uploaded.length > 0) {
        uploaded = uploaded[0].textContent;
        thumb = thumb[0].textContent;
        $('.unassigned-photo').each(function() {
            if ($(this).attr('data-image-filename') > uploaded) {
              var new_thumb = $('<div class="thumbnail">' +
                                '<img class="unassigned-photo"/>' +
                                '</div>');
              new_thumb.find('img')
                  .attr('data-image-filename', uploaded)
                  .attr('src', thumb)
                  .on('click', function() { photo_crop_expression(uploaded); });
              new_thumb.insertBefore($(this).parent());
              make_draggable_photo(new_thumb.find('img'));
              return false;  // exit the loop
            }
          });
      }
      file.previewElement.classList.add("dz-success");
    }
  },
  init: function() {
    var dz = this;

    this.on("complete", function(file) {
        if (file.status == 'success') {
          dz.removeFile(file);
        }
      });
  }
};
